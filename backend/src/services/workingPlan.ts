import { randomUUID } from 'node:crypto'
import { insertIfMissing, selectRows } from '../storage.js'
import { assertQuestMember, HttpError } from './access.js'
import { agreedStartingPoint } from './questJourney.js'
import { applyStartPreference, learningPrompt, questPersonalContext, questPlanningConstraints, signalFromEdit, travelRpc } from './travelMemory.js'
import { resolveRealPlace } from './realPlaceService.js'
import type { PlaceSource } from '../data/realPlaces.js'
import { resolveTravelDates, type TravelDates } from './travelDates.js'
import { questParticipants, sharedAvailability } from './questParticipants.js'
import { bookingTripDates, stayBookingDates, staysConflict } from './stayBookings.js'

export type PlanItem = { id: string; title: string; kind: 'experience' | 'food' | 'stay' | 'transport' | 'free'; time: string; duration: number; note: string; locked: boolean; booked?: boolean; imageQuery?: string; placeSource?: PlaceSource }
export type PlanDay = { id: string; title: string; items: PlanItem[] }
type BookedItems = { flights: string[]; stays: string[] }
export type PlanDocument = { title: string; destination: string; country: string; catalogueId: string; preferenceVersion?: string; travelDates?: TravelDates; days: PlanDay[]; bookings?: ReturnType<typeof bookingsFor>; booked?: BookedItems }
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

type BookingSource = { destination: string; country: string; duration_days: number; budget: string; location_type: string; estimated_cost_usd: number; currency?: string; travel_dates?: unknown; flights?: unknown[]; stays?: unknown[]; cover_image?: string | null }
function bookingsFor(trip: BookingSource) {
  if (!trip.flights?.length && !trip.stays?.length) return undefined
  return { destination: trip.destination, country: trip.country, duration_days: trip.duration_days, budget: trip.budget, location_type: trip.location_type, estimated_cost_usd: trip.estimated_cost_usd, currency: trip.currency, travel_dates: trip.travel_dates, flights: trip.flights, stays: trip.stays, cover_image: trip.cover_image ?? null }
}

export async function getWorkingPlan(roomId: string, userId: string) {
  await assertQuestMember(roomId, userId)
  const [row] = await selectRows<PlanRow>('quest_working_plans', columns, [{ column: 'id', operator: 'eq', value: roomId }])
  if (!row) return null
  return describeDatedPlan(row)
}

async function describeDatedPlan(row: PlanRow) {
  const saved = describePlan(row)
  let travelDates = resolveTravelDates(saved.travelDates ?? saved.bookings?.travel_dates, saved.days.length)
  if (!travelDates) {
    const group = await questParticipants(row.id)
    if (group.ready) travelDates = resolveTravelDates(undefined, saved.days.length, sharedAvailability(group.preferences))
  }
  // Legacy catalogue plans omitted dates. Enrich the response without rewriting
  // the saved document, revision, history, or the crew's current agreement.
  return { ...saved, ...(travelDates ? { travelDates } : {}) }
}

export async function startWorkingPlan(roomId: string, userId: string, catalogueId: unknown) {
  await assertPlanEditor(roomId, userId)
  const current = await getWorkingPlan(roomId, userId)
  if (current) return current
  const document = await startingDocument(roomId, userId, catalogueId)
  await insertIfMissing('quest_working_plans', { id: roomId, data: { document, history: [], requests: [] } })
  return getWorkingPlan(roomId, userId)
}

async function startingDocument(roomId: string, userId: string, catalogueId: unknown): Promise<PlanDocument> {
  const { trip, preferenceVersion, solo } = await agreedStartingPoint(roomId, userId, catalogueId)
  const days = (Array.isArray(trip.daily_plan) ? trip.daily_plan : []).map((value, index): PlanDay => {
    const day = value as Record<string, unknown>
    return { id: randomUUID(), title: `Day ${index + 1}`, items: ['morning', 'afternoon', 'evening'].flatMap((slot, slotIndex) => {
      const moment = (day.moments as Record<string, { activity?: unknown; detail?: unknown; imageQuery?: unknown; placeSource?: PlaceSource }> | undefined)?.[slot]
      const title = text(moment?.activity, 180) || text(day[slot], 180)
      const detail = text(moment?.detail, 400)
      const imageQuery = text(moment?.imageQuery, 100)
      const place = resolveRealPlace(moment?.placeSource?.placeId, title, trip.destination, trip.country)
      return title ? [{ id: randomUUID(), title: title.charAt(0).toUpperCase() + title.slice(1), kind: place?.kind ?? (/dinner|food|taste|lunch|breakfast|café|cafe|restaurant|market/i.test(`${title} ${detail}`) ? 'food' : 'experience'), time: ['10:00', '14:00', '19:00'][slotIndex], duration: 90, note: detail ? `${detail} Timing and availability need checking.` : 'Starting idea from the collection. Timing, location and availability need checking.', locked: false, ...(imageQuery ? { imageQuery } : {}), ...(place ? { placeSource: { ...place.source } } : {}) } satisfies PlanItem] : []
    }) }
  })
  if (!days.length) throw new HttpError(409, 'This idea has no days yet. Choose another starting point.')
  const personal = await questPersonalContext(userId, roomId)
  applyStartPreference(days, personal.explicitStart || personal.effective.dayStart)
  const travelDates = resolveTravelDates(trip.travel_dates, days.length)
  const document: PlanDocument = { preferenceVersion, title: solo ? `${trip.destination}, my way` : `${trip.destination}, together`, destination: trip.destination, country: trip.country, catalogueId: trip.id, ...(travelDates ? { travelDates } : {}), days, bookings: bookingsFor(trip) }
  return document
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
  if (command.type === 'booking') {
    const bookingType = String(command.bookingType)
    const bookingId = text(command.bookingId, 200)
    if (!bookingId || !['flight', 'stay', 'activity'].includes(bookingType) || typeof command.booked !== 'boolean') throw new HttpError(400, 'Choose a valid booking to update.')
    if (bookingType === 'activity') {
      const activity = next.days.flatMap(day => day.items).find(value => value.id === bookingId)
      if (!activity) throw new HttpError(404, 'This activity is no longer in the itinerary.')
      if (activity.kind === 'stay' && command.booked) throw new HttpError(409, 'Manage your hotel booking in Flights & stays. A check-in stop does not need a separate booking.')
      activity.booked = command.booked
      return { document: next, label: `${command.booked ? 'Booked' : 'Marked unbooked'} ${activity.title}` }
    }
    const key = bookingType === 'flight' ? 'flights' : 'stays'
    const available = bookingType === 'flight'
      ? (next.bookings?.flights ?? []).some(value => flightKey(value) === bookingId)
      : (next.bookings?.stays ?? []).some(value => stayKey(value) === bookingId)
    if (!available) throw new HttpError(404, 'This booking option is no longer in the itinerary.')
    const booked = next.booked ?? { flights: [], stays: [] }
    const values = new Set(booked[key])
    if (bookingType === 'stay' && command.booked && !values.has(bookingId)) {
      const stays = next.bookings?.stays ?? []
      const dates = bookingTripDates(next.travelDates ?? next.bookings?.travel_dates, next.bookings?.flights)
      const selected = stayBookingDates(stays.find(value => stayKey(value) === bookingId), dates)
      const conflict = [...values].some(id => staysConflict(selected, stayBookingDates(stays.find(value => stayKey(value) === id), dates)))
      if (conflict) throw new HttpError(409, 'Another stay is already marked for overlapping or unconfirmed dates. Unmark it first, or use separate dates for a split stay.')
    }
    if (command.booked) values.add(bookingId); else values.delete(bookingId)
    next.booked = { ...booked, [key]: [...values] }
    return { document: next, label: command.booked ? `Added ${bookingType} to your booked itinerary` : `Removed ${bookingType} from your booked itinerary` }
  }
  const targetDay = next.days.find(day => day.id === command.dayId)
  const sourceDay = next.days.find(day => day.items.some(item => item.id === command.itemId))
  const item = sourceDay?.items.find(item => item.id === command.itemId)
  if (command.type === 'add') {
    if (!targetDay || next.days.reduce((n, day) => n + day.items.length, 0) >= 120) throw new HttpError(400, 'Choose a day with room for another idea.')
    const value = validateItem(command)
    const place = resolveRealPlace(command.placeId, value.title, document.destination, document.country, value.kind)
    targetDay.items.push({ ...value, id: randomUUID(), locked: false, ...(place ? { placeSource: { ...place.source }, imageQuery: `${place.name} ${place.destination}` } : {}) })
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
    if (value.title !== item.title || value.kind !== item.kind) { delete item.imageQuery; delete item.placeSource }
    Object.assign(item, value)
    return { document: next, label: `Updated ${item.title}` }
  }
  throw new HttpError(400, 'This change is not supported.')
}

function flightKey(value: unknown) {
  const flight = value as { flightNumber?: unknown; airline?: unknown; fromCode?: unknown; toCode?: unknown; departDate?: unknown }
  return [text(flight.flightNumber, 30), text(flight.airline, 80), text(flight.fromCode, 10), text(flight.toCode, 10), text(flight.departDate, 20)].join('|')
}
function stayKey(value: unknown) {
  const stay = value as { name?: unknown; area?: unknown }
  return [text(stay.name, 120), text(stay.area, 120)].join('|')
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
  if (row.data.requests.includes(input.requestId)) return describeDatedPlan(row)
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
    if (input.type === 'itinerary' || input.type === 'switch') {
      if (row.data.document.days.some(day => day.items.some(item => item.locked))) throw new HttpError(409, 'Your plan has locked activities. Unlock them before switching itineraries.')
      document = await startingDocument(roomId, userId, input.catalogueId)
      history = [...history, { eventId, label: 'Switched to a group-approved itinerary', document: row.data.document }].slice(-30)
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
  return { ...await describeDatedPlan(updated).catch(() => describePlan(updated)), learningPrompt: prompt }
}
