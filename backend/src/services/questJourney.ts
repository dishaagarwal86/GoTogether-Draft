import { randomBytes, randomUUID } from 'node:crypto'
import { deleteRows, insertIfMissing, selectRows, updateRows, upsertRow } from '../storage.js'
import { assertQuestMember, HttpError } from './access.js'
import { contextKey } from './aiHistory.js'
import { recommendForQuest, publicRecommendations } from './recommendationService.js'
import type { PlanDocument } from './workingPlan.js'
import { travelRpc } from './travelMemory.js'
import { questParticipants } from './questParticipants.js'

type ResponseRow = { participant_id: string; kind: string; option_id: string; context_version: string; reaction: 'love' | 'works' | 'concern'; note: string }
type PlanRow = { id: string; revision: number; data: { document: PlanDocument } }
const columns = ['participant_id', 'kind', 'option_id', 'context_version', 'reaction', 'note']

export async function assertJourneyHost(roomId: string, userId: string) {
  await assertQuestMember(roomId, userId)
  const [member] = await selectRows('trip_room_people', ['role'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'user_id', operator: 'eq', value: userId }])
  if (member?.role !== 'owner') throw new HttpError(403, 'Only the host can manage the crew.')
}

export async function getQuestJourney(roomId: string, userId: string) {
  const [recommendations, responses, plans] = await Promise.all([
    recommendForQuest(roomId),
    selectRows<ResponseRow>('quest_journey_responses', columns, [{ column: 'room_id', operator: 'eq', value: roomId }]),
    selectRows<PlanRow>('quest_working_plans', ['id', 'revision', 'data'], [{ column: 'id', operator: 'eq', value: roomId }]),
  ])
  const version = recommendations.preferenceVersion
  const summarise = (kind: string, optionId: string, context: string) => {
    const people = recommendations.participants.map(person => {
      const response = responses.find(row => row.participant_id === person.id && row.kind === kind && row.option_id === optionId && row.context_version === context)
      return { id: person.id, name: person.name, isMe: person.id === userId, reaction: response?.reaction ?? null, note: response?.note ?? '' }
    })
    const answered = people.filter(person => person.reaction).length
    const concerns = people.filter(person => person.reaction === 'concern').length
    return { people, answered, concerns, agreed: recommendations.ready && people.length === recommendations.totalMembers && answered === recommendations.totalMembers && concerns === 0 }
  }
  const options = Object.fromEntries(recommendations.allResults.map(trip => [trip.id, summarise('option', trip.id, version)]))
  const plan = plans[0]
  const planVersion = plan ? contextKey([version, plan.revision, plan.data.document]) : null
  const review = plan && planVersion ? summarise('plan', 'current', planVersion) : null
  const stillFits = Boolean(plan && recommendations.allResults.some(trip => trip.id === plan.data.document.catalogueId))
  return { ...publicRecommendations(recommendations, userId), options, currentPlan: plan?.data.document ?? null,
    planReview: plan && review ? { ...review, version: planVersion!, revision: plan.revision, preferencesChanged: plan.data.document.preferenceVersion !== version, canConfirm: recommendations.ready && stillFits, status: review.agreed && stillFits ? 'agreed' as const : 'review' as const } : null }
}

export async function respondToJourney(roomId: string, participantId: string, input: Record<string, unknown>) {
  const journey = await getQuestJourney(roomId, participantId)
  if (!journey.participants.some(person => person.id === participantId)) throw new HttpError(403, 'Join this quest before responding.')
  if (!journey.ready) throw new HttpError(409, 'Everyone must confirm their preferences first.')
  const kind = input.kind === 'plan' ? 'plan' : input.kind === 'option' ? 'option' : ''
  const optionId = kind === 'plan' ? 'current' : String(input.optionId ?? '')
  const version = kind === 'plan' ? journey.planReview?.version : journey.preferenceVersion
  if (!kind || !['love', 'works', 'concern'].includes(String(input.reaction))) throw new HttpError(400, 'Choose a response to this itinerary.')
  if (!version || input.version !== version) throw new HttpError(409, 'The group preferences or plan changed. Review the latest version before responding.')
  if (kind === 'option' && !journey.options[optionId] || kind === 'plan' && !journey.planReview?.canConfirm) throw new HttpError(409, 'This itinerary no longer fits the current shared requirements. Review the group options.')
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 600) : ''
  await upsertRow('quest_journey_responses', { id: randomUUID(), room_id: roomId, participant_id: participantId, kind, option_id: optionId, context_version: version, reaction: input.reaction, note, updated_at: new Date().toISOString() }, ['room_id', 'participant_id', 'kind', 'option_id'])
  return { ok: true }
}

export async function agreedStartingPoint(roomId: string, userId: string, catalogueId: unknown) {
  const journey = await getQuestJourney(roomId, userId)
  if (!journey.ready) throw new HttpError(409, 'Wait for every traveller to confirm their preferences before choosing a plan.')
  const trip = journey.allResults.find(item => item.id === catalogueId)
  if (!trip) throw new HttpError(409, 'This itinerary no longer fits the group. Refresh your options.')
  if (journey.totalMembers > 1 && !journey.options[trip.id]?.agreed) throw new HttpError(409, 'Everyone needs to respond positively to this itinerary before it becomes the shared plan.')
  return { trip, preferenceVersion: journey.preferenceVersion, solo: journey.totalMembers === 1 }
}

const origin = () => (process.env.APP_URL ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '')
export async function getJoinLink(roomId: string, userId: string, rotate = false) {
  await assertJourneyHost(roomId, userId)
  if (rotate) await updateRows('quest_join_links', { token: randomBytes(32).toString('hex'), created_at: new Date().toISOString() }, [{ column: 'id', operator: 'eq', value: roomId }], ['id'])
  await insertIfMissing('quest_join_links', { id: roomId, token: randomBytes(32).toString('hex') })
  const [link] = await selectRows<{ token: string }>('quest_join_links', ['token'], [{ column: 'id', operator: 'eq', value: roomId }])
  return { url: `${origin()}/join-room/${link.token}` }
}
export async function sharedInvitation(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(404, 'This invitation is unavailable.')
  const [link] = await selectRows<{ id: string }>('quest_join_links', ['id'], [{ column: 'token', operator: 'eq', value: token }])
  if (!link) throw new HttpError(404, 'This invitation has been replaced. Ask your host for the latest link.')
  const group = await questParticipants(link.id)
  return { roomId: link.id, name: group.room.name, host: group.participants.find(person => person.role === 'owner')?.name ?? 'Your host', totalMembers: group.totalMembers, completedMembers: group.completedMembers }
}
export async function joinSharedRoom(token: string, userId: string) {
  await sharedInvitation(token)
  return travelRpc<{ roomId: string }>('join_quest_by_link', { p_token: token, p_user: userId })
}
export async function manageCrew(roomId: string, userId: string, input: Record<string, unknown>) {
  await assertJourneyHost(roomId, userId)
  const group = await questParticipants(roomId)
  if (input.action === 'resize') {
    const size = Number(input.members)
    if (!Number.isInteger(size) || size < group.participants.length || size > 60) throw new HttpError(400, `Choose ${group.participants.length} to 60 travellers. Remove a departed traveller before reducing the crew.`)
    if (size === 1) throw new HttpError(400, 'Choose Just me to switch this room to solo travel.')
    await updateRows('trip_rooms', { members: size }, [{ column: 'id', operator: 'eq', value: roomId }], ['id'])
  } else if (input.action === 'remove') {
    const person = group.participants.find(person => person.id === input.participantId)
    if (!person || person.role === 'owner') throw new HttpError(400, 'Choose an invited traveller or member to remove.')
    if (person.inviteId) await updateRows('trip_room_invites', { status: 'revoked' }, [{ column: 'id', operator: 'eq', value: person.inviteId }, { column: 'trip_room_id', operator: 'eq', value: roomId }], ['id'])
    else await deleteRows('trip_room_people', [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'user_id', operator: 'eq', value: person.id }])
    await deleteRows('quest_journey_responses', [{ column: 'room_id', operator: 'eq', value: roomId }, { column: 'participant_id', operator: 'eq', value: person.id }])
    // Removing someone does not silently shrink the expected crew. The host
    // explicitly confirms the new count or invites a replacement.
  } else throw new HttpError(400, 'Choose a crew update.')
  return { ok: true }
}

export async function changeTravelMode(roomId: string, userId: string, input: Record<string, unknown>) {
  await assertJourneyHost(roomId, userId)
  if (!['solo', 'group'].includes(String(input.mode)) || typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestId)) throw new HttpError(400, 'Choose how you would like to travel.')
  return travelRpc<{ roomId: string; copied: boolean; mode: 'solo' | 'group' }>('change_quest_mode', { p_room: roomId, p_user: userId, p_mode: input.mode, p_request: input.requestId })
}
