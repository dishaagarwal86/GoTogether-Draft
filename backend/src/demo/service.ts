import { randomBytes, randomUUID } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { demoEnabled, demoMarker, demoRoomPrefix } from './config.js'
import { dates, demoOptions, people, scenes, type SceneKey } from './scenario.js'
import { insertRow, selectRows, updateRows, upsertRow } from '../storage.js'
import { endSession, loginUser, registerUser } from '../services/authService.js'
import { create } from '../services/apiStore.js'
import { validatePreferencePayload } from '../services/preferenceValidation.js'
import { getJoinLink, getQuestJourney, respondToJourney } from '../services/questJourney.js'
import { startWorkingPlan, type PlanDocument } from '../services/workingPlan.js'
import { createQuestMessage } from '../services/chatService.js'
import { createPick, getShortlist, reactToSharedPick, sharePick } from '../services/shortlistService.js'
import { confirmPastTrip, draftPastTrip } from '../services/travelMemory.js'
import { listConfirmations, setConfirmation } from '../services/questVoting.js'
import { HttpError } from '../services/access.js'

type Actor = { key: string; userId: string; email: string; password: string }
type Manifest = { marker: string; createdAt: string; actors: Actor[]; rooms: Record<SceneKey, string> }
const manifestPath = new URL('../../.local-demo.json', import.meta.url)
const whereId = (id: string) => [{ column: 'id', operator: 'eq' as const, value: id }]
function requireDemo() { if (!demoEnabled()) throw new HttpError(404, 'Local quest demo is unavailable.') }

async function readManifest(): Promise<Manifest> {
  requireDemo()
  try {
    const value = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
    if (value.marker !== demoMarker || people.some(person => !value.actors.some(actor => actor.key === person.key))) throw new Error('Invalid manifest')
    return value
  } catch { throw new HttpError(503, 'Create the local demo with npm run seed:demo in backend first.') }
}

export async function describeDemo() {
  const manifest = await readManifest()
  return { createdAt: manifest.createdAt, dates,
    actors: people.map(person => ({ ...person, userId: manifest.actors.find(actor => actor.key === person.key)!.userId })),
    scenes: scenes.map(scene => ({ ...scene, roomId: manifest.rooms[scene.key] })) }
}

export async function demoSession(key: unknown) {
  const manifest = await readManifest()
  const actor = manifest.actors.find(actor => actor.key === key)
  if (!actor || !people.some(person => person.key === key)) throw new HttpError(404, 'Choose a demo traveller.')
  const [user] = await selectRows<{ email: string; data: Record<string, unknown> }>('users', ['email', 'data'], whereId(actor.userId))
  if (!user || user.data.demo !== demoMarker || user.email !== actor.email || !user.email.endsWith('@demo.gotogether.test')) throw new HttpError(403, 'Only fictional demo accounts can be used here.')
  return loginUser(actor.email, actor.password)
}

async function addHistory(actor: Actor, person: typeof people[number]) {
  const text = `Day 1: ${person.firstName} met friends in Fort Kochi, explored the waterfront and stopped for a relaxed vegetarian lunch.\nDay 2: The group visited local cafés, took photographs and kept the afternoon flexible before heading home.`
  const draft = await draftPastTrip(actor.userId, { text })
  await confirmPastTrip(actor.userId, draft.id, { ...draft, title: 'Fictional travel memory · A Kochi weekend', destination: 'Kochi', endDate: '2025-11-16', context: 'friends', reflection: `${person.firstName}'s demo reflection: ${person.preferred}. Next time I would protect a longer lunch break.`, loved: [...person.moods], pace: person.pace, dayStart: person.start, completed: true, mine: true, remember: true })
}

async function addConversation(roomId: string, actors: Actor[], scene: SceneKey) {
  const messages: [number, string][] = [
    [0, 'Four days in Bangkok! Two twin rooms, a temple morning and plenty of food. What would make this trip yours?'],
    [1, 'Grand Palace and Wat Arun are my must-haves. I can skip a second museum so Riya gets a proper market morning.'],
    [2, 'I am in if we keep vegetarian meal options and a full lunch break. Around ₹55,000 including my flight is my comfort zone.'],
    [3, 'Chatuchak on Saturday please! I would love a café afternoon. Happy to join one temple, but not a full day of rushing.'],
  ]
  if (scene !== 'gather') messages.push([0, 'Compare all three options. “Bangkok, with room for everyone” includes each person’s main wish. Please use Have a concern if something still needs changing.'])
  if (scene === 'review') messages.push([2, 'The draft has lunch in the notes, but I want a separate 90-minute break on Friday so it does not disappear. I have left a concern on the plan.'], [3, 'I have not reviewed this version yet. I will check the Saturday market timing next.'])
  if (scene === 'ready') messages.push([0, 'Friday now has a separate lunch and rest break before Wat Arun. Saturday starts later, with an optional café afternoon.'], [2, 'That resolves my concern. I am happy with this version; let us check current flight and hotel prices before booking.'], [3, 'Saturday works for me. All in!'], [1, 'Temples, a relaxed lunch and space for everyone. Love this plan.'])
  for (const [index, body] of messages) await createQuestMessage(roomId, actors[index].userId, body)
}

async function addIdeas(roomId: string, actors: Actor[]) {
  const ideas = [
    { owner: 3, title: 'Chatuchak Weekend Market', note: 'Saturday morning, two hours and a shared meeting point.', image: 'thailand-chatuchak', reactions: ['works', 'works', 'works', 'love'] },
    { owner: 1, title: 'Sky Bar evening', note: 'Optional splurge; compare the menu and dress policy before deciding.', image: 'thailand-sky-bar', reactions: ['works', 'love', 'not_for_me', 'not_for_me'] },
    { owner: 0, title: 'One more Sukhumvit café', note: 'A flexible afternoon idea. Nobody has to join.', image: 'thailand-sukhumvit', reactions: ['love', null, 'works', null] },
  ]
  for (const idea of ideas) {
    const pick = await createPick(roomId, actors[idea.owner].userId, { type: 'activity', title: idea.title, destination: 'Bangkok', note: idea.note, imageUrl: `/photos/places/${idea.image}.webp` })
    await sharePick(roomId, actors[idea.owner].userId, pick.id)
    const shared = (await getShortlist(roomId, actors[0].userId)).sharedShortlist.find(item => item.title === idea.title)!
    for (const [index, reaction] of idea.reactions.entries()) if (reaction) await reactToSharedPick(roomId, actors[index].userId, shared.id, { reaction, note: reaction === 'not_for_me' ? index === 2 ? 'This would stretch my budget. I would prefer a simple riverside dinner.' : 'I would prefer a quiet evening after the market.' : '' })
  }
}

async function addVotes(roomId: string, actors: Actor[], scene: SceneKey) {
  const journey = await getQuestJourney(roomId, actors[0].userId)
  const matrix = [scene === 'compare' ? ['love', 'works', 'concern', null] : ['love', 'works', 'works', 'love'], ['works', 'love', 'concern', 'concern'], [null, 'concern', 'love', 'love']]
  for (const [optionIndex, option] of demoOptions().entries()) {
    for (const [index, reaction] of matrix[optionIndex].entries()) if (reaction) await respondToJourney(roomId, actors[index].userId, { kind: 'option', optionId: option.id, version: journey.preferenceVersion, reaction, note: reaction === 'concern' ? index === 2 ? 'Please protect a proper lunch and rest break on the temple day.' : index === 3 ? 'Too much temple time; I do not want to miss Chatuchak.' : 'I would miss the Grand Palace on this version.' : '' })
  }
}

async function addPlan(roomId: string, actors: Actor[], scene: SceneKey) {
  const plan = await startWorkingPlan(roomId, actors[0].userId, 'demo-bangkok-balanced')
  if (!plan) throw new Error('Demo plan did not save')
  const { revision: _revision, canUndo: _undo, updatedAt: _updated, ...document } = plan
  const days = demoOptions()[0].daily_plan as Array<{ title: string }>
  document.title = 'Four friends, four days in Bangkok'
  document.days.forEach((day, index) => { day.title = days[index].title })
  const friday = document.days[1]
  friday.items[1].time = scene === 'ready' ? '15:00' : '14:00'
  document.days[2].items[0].time = '10:30'
  document.days[0].items[0].kind = 'transport'
  document.days[0].items[1].kind = 'stay'
  document.days[3].items[2].kind = 'transport'
  if (scene === 'ready') {
    const stay = document.bookings?.stays?.[0] as { name: string; area: string } | undefined
    // The completed showcase has one fictional shared stay recorded. The
    // other neighbourhood remains an unselected alternative for comparison.
    if (stay) document.booked = { flights: [], stays: [`${stay.name}|${stay.area}`] }
  }
  if (scene === 'ready') friday.items.splice(1, 0, { id: randomUUID(), title: 'Vegetarian lunch and a proper rest', kind: 'food', time: '12:30', duration: 90, note: 'Kabir’s request, agreed by everyone. Choose a restaurant with clear vegetarian ingredients; allow time to sit and cool down.', locked: true, imageQuery: 'Bangkok' })
  await updateRows('quest_working_plans', { data: { document: document satisfies PlanDocument, history: [], requests: [] } }, whereId(roomId), ['id'])
  const journey = await getQuestJourney(roomId, actors[0].userId)
  for (const [index, actor] of actors.entries()) {
    if (scene === 'review' && index === 3) continue
    await respondToJourney(roomId, actor.userId, { kind: 'plan', version: journey.planReview!.version, reaction: scene === 'review' && index === 2 ? 'concern' : index === 1 ? 'love' : 'works', note: scene === 'review' && index === 2 ? 'Please make Friday lunch a separate 90-minute stop before Wat Arun.' : scene === 'ready' && index === 2 ? 'The protected lunch break resolves my concern. This works for me.' : '' })
  }
  const confirmations = await listConfirmations(roomId, actors[0].userId)
  for (const day of document.days) for (const item of day.items) for (const actor of scene === 'ready' ? actors : actors.slice(0, 2)) await setConfirmation(roomId, actor.userId, item.id, true, confirmations.versions[item.id])
}

// Explicit CLI operation: each run creates a new cohort. Existing rooms and edits
// survive; the private manifest changes only once all four scenes are complete.
export async function seedDemo() {
  requireDemo()
  const cohort = randomUUID()
  const manifest: Manifest = { marker: demoMarker, createdAt: new Date().toISOString(), actors: [], rooms: {} as Manifest['rooms'] }
  for (const person of people) {
    const password = randomBytes(32).toString('base64url')
    const email = `${person.key}.${cohort}@demo.gotogether.test`
    const session = await registerUser({ firstName: person.firstName, lastName: person.lastName, country: 'India', email, password })
    await endSession(session.token)
    const [row] = await selectRows<{ data: Record<string, unknown> }>('users', ['data'], whereId(session.user.id))
    await updateRows('users', { data: { ...row.data, demo: demoMarker } }, whereId(session.user.id), ['id'])
    const actor = { key: person.key, userId: session.user.id, email, password }
    manifest.actors.push(actor)
    await addHistory(actor, person)
  }
  for (const scene of scenes) {
    const roomId = `${demoRoomPrefix}${cohort}_${scene.key}`
    manifest.rooms[scene.key] = roomId
    await insertRow('trip_rooms', { id: roomId, name: `Bangkok · ${scene.name}`, trip_name: 'Four friends, four days', members: 4 }, ['id'])
    for (const [index, actor] of manifest.actors.entries()) {
      const person = people[index]
      await upsertRow('trip_room_people', { trip_room_id: roomId, user_id: actor.userId, role: index === 0 ? 'owner' : 'member', invite_status: 'accepted' }, ['trip_room_id', 'user_id'])
      await create('preferences', 'preference', { userId: actor.userId, ...validatePreferencePayload({ tripRoomId: roomId, dates, budget: person.budget, daysCount: 4, peopleCount: 4, locationPreferences: { scope: 'International', destination: 'Bangkok', departureCity: person.city, fixed: true }, moodPreferences: [...person.moods], pace: person.pace, dayStart: person.start, activitiesMustHave: person.must, activitiesPreferred: person.preferred, noGo: person.noGo, companions: 'friends', currency: 'INR', homeCountry: 'India', accommodationPreferences: ['Hotel'], submitted: scene.key !== 'gather' || index !== 3, personalizationEnabled: true }) })
    }
    await getJoinLink(roomId, manifest.actors[0].userId)
    await addConversation(roomId, manifest.actors, scene.key)
    await addIdeas(roomId, manifest.actors)
    if (scene.key !== 'gather') await addVotes(roomId, manifest.actors, scene.key)
    if (scene.key === 'review' || scene.key === 'ready') await addPlan(roomId, manifest.actors, scene.key)
  }
  const temporary = new URL(`${manifestPath.href}.${cohort}.tmp`)
  await writeFile(temporary, JSON.stringify(manifest, null, 2), { mode: 0o600 })
  await rename(temporary, manifestPath)
  return describeDemo()
}
