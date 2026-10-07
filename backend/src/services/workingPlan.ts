import { randomUUID } from 'node:crypto'
import { insertIfMissing, selectRows } from '../storage.js'
import { assertQuestMember, HttpError } from './access.js'
import { recommendForQuest } from './recommendationService.js'
import { applyStartPreference, learningPrompt, questPersonalContext, questPlanningConstraints, signalFromEdit, travelRpc } from './travelMemory.js'

export type PlanItem = { id: string; title: string; kind: 'experience' | 'food' | 'stay' | 'transport' | 'free'; time: string; duration: number; note: string; locked: boolean; imageQuery?: string }
export type PlanDay = { id: string; title: string; items: PlanItem[] }
export type PlanDocument = { title: string; destination: string; country: string; catalogueId: string; days: PlanDay[]; bookings?: Record<string, unknown> }
type Snapshot = { eventId?: string; label: string; document: PlanDocument }
type RecordData = { document: PlanDocument; history: Snapshot[]; requests: string[] }
type PlanRow = { id: string; revision: number; data: RecordData; updated_at: string }
const columns = ['id', 'revision', 'data', 'updated_at']
const kinds = ['experience', 'food', 'stay', 'transport', 'free']
export const describePlan = (row: PlanRow) => ({ ...row.data.document, revision: row.revision, canUndo: row.data.history.length > 0, updatedAt: row.updated_at })
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''

export async function assertPlanEditor(roomId: string, userId: string) {
  await assertQuestMember(roomId, userId)
  const [member] = await selectRows('trip_room_people', ['role'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'user_id', operator: 'eq', value: userId }])
  if (member?.role !== 'owner') throw new HttpError(403, 'The quest host can edit the shared plan. Discuss your suggestion with the crew.')
}

type BookingSource = { destination: string; duration_days: number; budget: string; location_type: string; estimated_cost_usd: number; currency?: string; travel_dates?: unknown; flights?: unknown[]; stays?: unknown[]; cover_image?: string | null }
function bookingsFor(trip: BookingSource) {
  if (!trip.flights?.length && !trip.stays?.length) return undefined
  return { destination: trip.destination, duration_days: trip.duration_days, budget: trip.budget, location_type: trip.location_type, estimated_cost_usd: trip.estimated_cost_usd, currency: trip.currency, travel_dates: trip.travel_dates, flights: trip.flights, stays: trip.stays, cover_image: trip.cover_image ?? null }
}

// Plans started before bookings were stored can still find them in the AI itinerary cache.
async function cachedBookings(roomId: string, catalogueId: string) {
  const version = /^ai-([0-9a-f]{12})-\d$/.exec(catalogueId)?.[1]
  if (!version) return undefined
  const rows = await selectRows<{ data: { results?: Array<BookingSource & { id: string }> } }>('suggested_itineraries', ['data'], [{ column: 'id', operator: 'ilike', value: `aiq_${roomId}_${version}%` }])
  const trip = rows.flatMap(row => row.data.results ?? []).find(item => item.id === catalogueId)
  return trip ? bookingsFor(trip) : undefined
}

export async function getWorkingPlan(roomId: string, userId: string) {
  await assertQuestMember(roomId, userId)
  const [row] = await selectRows<PlanRow>('quest_working_plans', columns, [{ column: 'id', operator: 'eq', value: roomId }])
  if (!row) return null
  const plan = describePlan(row)
  return plan.bookings ? plan : { ...plan, bookings: await cachedBookings(roomId, plan.catalogueId) }
}

async function buildDocument(roomId: string, userId: string, catalogueId: unknown): Promise<PlanDocument> {
  const recommendations = await recommendForQuest(roomId)
  const trip = recommendations.results.find(item => item.id === catalogueId)
  if (!trip) throw new HttpError(409, 'This starting point has changed. Refresh the trip ideas and choose again.')
  const days = (Array.isArray(trip.daily_plan) ? trip.daily_plan : []).map((value, index): PlanDay => {
    const day = value as Record<string, unknown>
    return { id: randomUUID(), title: `Day ${index + 1}`, items: ['morning', 'afternoon', 'evening'].flatMap((slot, slotIndex) => {
      const moment = (day.moments as Record<string, { activity?: unknown; detail?: unknown; imageQuery?: unknown }> | undefined)?.[slot]
      const title = text(moment?.activity, 180) || text(day[slot], 180)
      const detail = text(moment?.detail, 400)
      const imageQuery = text(moment?.imageQuery, 100)
      return title ? [{ id: randomUUID(), title: title.charAt(0).toUpperCase() + title.slice(1), kind: /dinner|food|taste|lunch|breakfast|café|cafe|restaurant|market/i.test(`${title} ${detail}`) ? 'food' : 'experience', time: ['10:00', '14:00', '19:00'][slotIndex], duration: 90, note: detail ? `${detail} Timing and availability need checking.` : 'Starting idea from the collection. Timing, location and availability need checking.', locked: false, ...(imageQuery ? { imageQuery } : {}) } satisfies PlanItem] : []
    }) }
  })
  if (!days.length) throw new HttpError(409, 'This idea has no days yet. Choose another starting point.')
  const personal = await questPersonalContext(userId, roomId)
  applyStartPreference(days, personal.explicitStart || personal.effective.dayStart)
  const bookings = bookingsFor(trip)
  return { title: `${trip.destination}, together`, destination: trip.destination, country: trip.country, catalogueId: trip.id, days, ...(bookings ? { bookings } : {}) }
}

export async function startWorkingPlan(roomId: string, userId: string, catalogueId: unknown) {
  await assertPlanEditor(roomId, userId)
  const current = await getWorkingPlan(roomId, userId)
  if (current) return current
  const document = await buildDocument(roomId, userId, catalogueId)
  await insertIfMissing('quest_working_plans', { id: roomId, data: { document, history: [], requests: [] } })
  return getWorkingPlan(roomId, userId)
}

// These commands are also the contract for future reviewed AI edit proposals.
// A model can never write a plan directly or bypass locks and revision checks.
export function applyPlanCommand(document: PlanDocument, command: Record<string, unknown>): { document: PlanDocument; label: string } {
  const next = structuredClone(document)
  if (command.type === 'rename') {
    const title = text(command.title, 100)
    if (!title) throw new HttpError(400, 'Give your trip a short name.')
    next.title = title
    return { document: next, label: 'Renamed the trip' }
  }
  const targetDay = next.days.find(day => day.id === command.dayId)
  const sourceDay = next.days.find(day => day.items.some(item => item.id === command.itemId))
  const item = sourceDay?.items.find(item => item.id === command.itemId)
  if (command.type === 'add') {
    if (!targetDay || next.days.reduce((n, day) => n + day.items.length, 0) >= 120) throw new HttpError(400, 'Choose a day with room for another idea.')
    const value = validateItem(command)
    targetDay.items.push({ ...value, id: randomUUID(), locked: false })
    return { document: next, label: `Added ${value.title}` }
  }
  if (!item || !sourceDay) throw new HttpError(404, 'This activity is no longer in the plan.')
  if (command.type === 'lock') {
    item.locked = !item.locked
    return { document: next, label: `${item.locked ? 'Locked' : 'Unlocked'} ${item.title}` }
  }
  if (item.locked) throw new HttpError(409, 'Unlock this activity before changing it.')
  if (command.type === 'move') {
    if (!targetDay || !Number.isInteger(command.index) || Number(command.index) < 0 || Number(command.index) > targetDay.items.length) throw new HttpError(400, 'Choose a valid position in the day.')
    sourceDay.items = sourceDay.items.filter(value => value.id !== item.id)
    // Array order is planning order. Moving does not silently reschedule times.
    targetDay.items.splice(Math.min(Number(command.index), targetDay.items.length), 0, item)
    return { document: next, label: `Moved ${item.title} to ${targetDay.title}` }
  }
  if (command.type === 'remove') {
    sourceDay.items = sourceDay.items.filter(value => value.id !== item.id)
    return { document: next, label: `Removed ${item.title}` }
  }
  if (command.type === 'update') {
    const value = validateItem(command)
    if (value.title !== item.title) delete item.imageQuery
    Object.assign(item, value)
    return { document: next, label: `Updated ${item.title}` }
  }
  throw new HttpError(400, 'This change is not supported.')
}

function validateItem(input: Record<string, unknown>): Omit<PlanItem, 'id' | 'locked'> {
  const title = text(input.title, 180)
  if (!title || !kinds.includes(String(input.kind)) || typeof input.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.time) || !Number.isInteger(input.duration) || Number(input.duration) < 15 || Number(input.duration) > 720) throw new HttpError(400, 'Add a title, activity type, valid time and duration between 15 and 720 minutes.')
  return { title, kind: input.kind as PlanItem['kind'], time: input.time, duration: Number(input.duration), note: text(input.note, 1000) }
}

export async function changeWorkingPlan(roomId: string, userId: string, input: Record<string, unknown>) {
  await assertPlanEditor(roomId, userId)
  if (!Number.isInteger(input.expectedRevision) || typeof input.requestId !== 'string' || !/^[\w-]{12,80}$/.test(input.requestId)) throw new HttpError(400, 'This change needs a revision and a unique request ID.')
  const [row] = await selectRows<PlanRow>('quest_working_plans', columns, [{ column: 'id', operator: 'eq', value: roomId }])
  if (!row) throw new HttpError(404, 'Save a starting plan first.')
  // Known retries return the latest state. Older retries fail their revision check.
  if (row.data.requests.includes(input.requestId)) return describePlan(row)
  if (input.expectedRevision !== row.revision) throw new HttpError(409, 'The plan changed in another window. Load the latest version before applying your change.')
  let document: PlanDocument
  let history = row.data.history
  let undoEvent: string | undefined
  let proposalId: string | undefined
  let signal: ReturnType<typeof signalFromEdit> = null
  const eventId = `${roomId}:${input.requestId}`
  const personal = await questPersonalContext(userId, roomId)
  if (input.type === 'undo') {
    if (!history.length) throw new HttpError(409, 'There are no changes to undo.')
    undoEvent = history.at(-1)!.eventId
    document = history.at(-1)!.document
    history = history.slice(0, -1)
  } else {
    if (input.type === 'switch') {
      // Replacing the whole plan keeps the old one as an undo step.
      document = await buildDocument(roomId, userId, input.catalogueId)
      history = [...history, { eventId, label: `Switched to ${document.destination}`, document: row.data.document }].slice(-30)
    } else if (input.type === 'proposal') {
      const [job] = await selectRows<{ id: string; base_revision: number; state: string; data: { commands: Record<string, unknown>[]; constraintsFingerprint?: string } }>('travel_ai_jobs', ['id', 'base_revision', 'state', 'data'], [{ column: 'id', operator: 'eq', value: String(input.proposalId) }, { column: 'user_id', operator: 'eq', value: userId }, { column: 'room_id', operator: 'eq', value: roomId }])
      if (!job || job.state !== 'ready' || job.base_revision !== row.revision) throw new HttpError(409, 'This suggestion is no longer current. Ask for a new preview.')
      if (job.data.constraintsFingerprint !== (await questPlanningConstraints(roomId)).fingerprint) throw new HttpError(409, 'Trip preferences changed since this preview. Ask for a fresh suggestion.')
      proposalId = job.id
      document = job.data.commands.reduce<PlanDocument>((plan, command) => applyPlanCommand(plan, command).document, row.data.document)
      history = [...history, { eventId, label: 'Applied reviewed suggestions', document: row.data.document }].slice(-30)
    } else {
      const applied = applyPlanCommand(row.data.document, input)
      document = applied.document
      signal = personal.profile.settings.learningEnabled ? signalFromEdit(row.data.document, document, input) : null
      history = [...history, { eventId, label: applied.label, document: row.data.document }].slice(-30)
    }
  }
  const updated = await travelRpc<PlanRow>('commit_travel_plan', {
    p_user: userId, p_room: roomId, p_revision: row.revision, p_request: input.requestId,
    p_data: { document, history, requests: [...row.data.requests, input.requestId].slice(-60) },
    p_event: { type: input.type, signal, context: personal.context }, p_undo: undoEvent ?? null, p_proposal: proposalId ?? null,
  })
  // The revision is already durable; an optional nudge must not turn a saved
  // edit into a misleading failure response.
  const prompt = signal ? await learningPrompt(userId, eventId).catch(() => null) : null
  return { ...describePlan(updated), learningPrompt: prompt }
}
