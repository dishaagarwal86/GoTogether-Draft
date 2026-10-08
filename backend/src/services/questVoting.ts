import { selectRows, upsertRow } from '../storage.js'
import { assertQuestMember, HttpError } from './access.js'
import { contextKey } from './aiHistory.js'
import { getWorkingPlan, type PlanDay } from './workingPlan.js'
import { generateAi } from './aiProvider.js'
import { searchRealPlaces } from './realPlaceService.js'
import type { PlaceSource } from '../data/realPlaces.js'

type Row = { id: string; user_id: string; data: Record<string, unknown> }
const kinds = ['experience', 'food', 'stay', 'transport', 'free'] as const
export type AreaIdea = { title: string; kind: typeof kinds[number]; note: string; area: string; imageQuery: string; category?: string; placeSource?: PlaceSource }

async function acceptedMembers(roomId: string) {
  const people = await selectRows<{ user_id: string; role: string }>('trip_room_people', ['user_id', 'role'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'invite_status', operator: 'eq', value: 'accepted' }])
  const users = people.length ? await selectRows<{ id: string; first_name: string | null; email: string }>('users', ['id', 'first_name', 'email'], [{ column: 'id', operator: 'in', value: people.map(person => person.user_id) }]) : []
  const names = new Map(users.map(user => [user.id, user.first_name?.trim() || user.email.split('@')[0]]))
  return people.map(person => ({ id: person.user_id, name: names.get(person.user_id) ?? 'Traveller', role: person.role }))
}

// One row per activity and person prevents simultaneous confirmations for
// different cards from overwriting one another. Versions bind assent to content.
function activityVersions(days: PlanDay[]) {
  return Object.fromEntries(days.flatMap(day => day.items.map((item, index) => [item.id, contextKey([day.id, day.title, index, item.title, item.kind, item.time, item.duration, item.note])])))
}
const confirmationPrefix = (roomId: string) => `confirm2-${contextKey(roomId)}-`
export async function listConfirmations(roomId: string, userId: string) {
  const [plan, members, rows] = await Promise.all([
    getWorkingPlan(roomId, userId), acceptedMembers(roomId),
    selectRows<Row>('suggested_itineraries', ['id', 'user_id', 'data'], [{ column: 'id', operator: 'ilike', value: `${confirmationPrefix(roomId)}%` }]),
  ])
  const versions = activityVersions(plan?.days ?? [])
  const names = new Map(members.map(member => [member.id, member.name]))
  const confirmations: Record<string, Array<{ userId: string; name: string; isMe: boolean }>> = {}
  for (const row of rows) {
    const { itemId, itemVersion, confirmed } = row.data
    if (row.data.roomId !== roomId || !names.has(row.user_id) || typeof itemId !== 'string' || !versions[itemId] || itemVersion !== versions[itemId] || confirmed !== true) continue
    ;(confirmations[itemId] ??= []).push({ userId: row.user_id, name: names.get(row.user_id)!, isMe: row.user_id === userId })
  }
  return { memberCount: members.length, confirmations, versions, revision: plan?.revision ?? null }
}

export async function setConfirmation(roomId: string, userId: string, itemId: unknown, confirmed: unknown, itemVersion: unknown) {
  const plan = await getWorkingPlan(roomId, userId)
  if (typeof itemId !== 'string' || !itemId || itemId.length > 80 || typeof confirmed !== 'boolean') throw new HttpError(400, 'Choose an activity to confirm.')
  const currentVersion = activityVersions(plan?.days ?? [])[itemId]
  if (!currentVersion) throw new HttpError(404, 'This activity is no longer in the plan.')
  if (itemVersion !== currentVersion) throw new HttpError(409, 'This activity changed. Review it again before confirming.')
  const id = `${confirmationPrefix(roomId)}${contextKey([userId, itemId])}`
  await upsertRow('suggested_itineraries', { id, user_id: userId, data: { roomId, itemId, itemVersion, confirmed } }, ['id'])
  return listConfirmations(roomId, userId)
}

export const ideaCategories = [
  { id: 'breakfast', label: 'A slow breakfast', hint: 'cafés, bakeries and breakfast spots' },
  { id: 'downtime', label: 'An afternoon with no plans', hint: 'parks, gardens, baths and quiet spots to slow down' },
  { id: 'local', label: 'A local experience', hint: 'cooking classes, workshops and hands-on traditions' },
  { id: 'wander', label: 'A neighbourhood wander', hint: 'characterful neighbourhoods and streets to explore on foot' },
  { id: 'sights', label: 'Sights & landmarks', hint: 'iconic landmarks and viewpoints' },
  { id: 'culture', label: 'Culture & museums', hint: 'museums, galleries, temples and historic sites' },
  { id: 'evening', label: 'Evenings out', hint: 'dinner spots, food alleys, bars and night views' },
  { id: 'daytrip', label: 'Day trips', hint: 'easy day trips from the destination' },
  { id: 'stays', label: 'Places to stay', hint: 'properties with official source links; rates to check' },
] as const
type CategoryId = typeof ideaCategories[number]['id']
const categoryIds = ideaCategories.map(category => category.id) as string[]
const foodCategories: string[] = ['breakfast', 'evening']

function validateIdeas(value: unknown, allowed: string[] = categoryIds, minimum = 3): { ideas: AreaIdea[] } {
  const items = value && typeof value === 'object' && Array.isArray((value as { ideas?: unknown }).ideas) ? (value as { ideas: unknown[] }).ideas : []
  const str = (input: unknown, max: number) => typeof input === 'string' ? input.trim().slice(0, max) : ''
  const ideas = items.map(item => {
    const idea = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const category = (allowed.includes(str(idea.category, 20)) ? str(idea.category, 20) : allowed[0]) as CategoryId
    const kind: AreaIdea['kind'] = idea.kind === 'food' || foodCategories.includes(category) ? 'food' : 'experience'
    return { title: str(idea.title, 100), kind, note: str(idea.note, 300), area: str(idea.area, 80), imageQuery: str(idea.image_query ?? idea.imageQuery, 80), category }
  }).filter(idea => idea.title).slice(0, 40)
  if (ideas.length < minimum) throw new Error('Too few ideas.')
  return { ideas }
}

const ideaFormat = '{"ideas":[{"category":"one of the category ids","title":"named place or activity, max 8 words","kind":"experience|food","note":"one practical sentence","area":"neighbourhood or town","image_query":"2-4 words for a photo search, e.g. Borough Market London"}]}'

async function generateIdeas(place: string, search: string, categories: Array<typeof ideaCategories[number]>) {
  const list = categories.map(category => `${category.id} (${category.hint})`).join('; ')
  const ask = search
    ? `Suggest 10 specific, real things to do matching the supplied destination and search. Put each in the best-fitting category from: ${list}.`
    : `Suggest specific, real things to do in the supplied destination: 2 for EACH of these categories: ${list}.`
  return generateAi(`${ask} Use named places, restaurants, streets and experiences, never generic filler. Return JSON ${ideaFormat}. Never invent prices or opening hours.`,
    { destination: place, search }, value => validateIdeas(value, categories.map(category => category.id), search ? 3 : categories.length * 2), { ideas: [] },
    { model: process.env.AI_PROVIDER === 'ollama' ? process.env.OLLAMA_ITINERARY_MODEL : process.env.OPENAI_ITINERARY_MODEL })
}

type IdeaResult = { ideas: AreaIdea[]; categories: typeof ideaCategories; source: string }
const pendingIdeas = new Map<string, Promise<IdeaResult>>()
const ideaCache = new Map<string, { until: number; result: IdeaResult }>()
export async function areaIdeas(roomId: string, userId: string, destination: unknown, query: unknown) {
  await assertQuestMember(roomId, userId)
  const place = typeof destination === 'string' ? destination.trim().slice(0, 100) : ''
  const search = typeof query === 'string' ? query.trim().slice(0, 80) : ''
  const plan = await getWorkingPlan(roomId, userId)
  if (!place || place !== plan?.destination) throw new HttpError(400, 'Choose the destination in your current plan.')
  const sourced = searchRealPlaces(place, plan.country, search)
  // Serve reviewed identities immediately, including when AI is unavailable.
  // Unmatched searches can still ask AI; those results carry no source badge.
  if (sourced.length) return { ideas: sourced, categories: ideaCategories, source: 'official_sources' }
  const id = `ideas3-${contextKey([roomId, place.toLowerCase(), search.toLowerCase()])}`
  const cached = ideaCache.get(id)
  if (cached && cached.until > Date.now()) return cached.result
  const pending = pendingIdeas.get(id)
  if (pending) return pending
  if (pendingIdeas.size >= 4) return { ideas: [], categories: ideaCategories, source: 'fallback' }
  const job = (async (): Promise<IdeaResult> => {
    try {
      const [saved] = await selectRows<Row>('suggested_itineraries', ['id', 'user_id', 'data'], [{ column: 'id', operator: 'eq', value: id }])
      if (saved?.data.roomId === roomId && Array.isArray(saved.data.ideas) && saved.data.ideas.length) return { ideas: saved.data.ideas as AreaIdea[], categories: ideaCategories, source: 'cache' }
      const activityCategories = ideaCategories.filter(category => category.id !== 'stays')
      const batches = search ? [activityCategories] : [activityCategories.slice(0, 4), activityCategories.slice(4)]
      const results = await Promise.all(batches.map(batch => generateIdeas(place, search, batch)))
      const seen = new Set<string>()
      const ideas = results.flatMap(result => result.value.ideas).filter(idea => {
        const key = idea.title.toLocaleLowerCase().normalize('NFKC')
        if (seen.has(key)) return false
        seen.add(key); return true
      })
      if (ideas.length) await upsertRow('suggested_itineraries', { id, user_id: userId, data: { roomId, destination: place, search, ideas } }, ['id'])
      const result = { ideas, categories: ideaCategories, source: results.every(result => result.source !== 'fallback') ? 'ai' : ideas.length ? 'partial' : 'fallback' }
      ideaCache.set(id, { until: Date.now() + 300_000, result })
      if (ideaCache.size > 100) ideaCache.delete(ideaCache.keys().next().value!)
      return result
    } finally { pendingIdeas.delete(id) }
  })()
  pendingIdeas.set(id, job)
  return job
}
