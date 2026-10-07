import { randomUUID } from 'node:crypto'
import { insertIfMissing, selectRows, updateRows } from '../storage.js'
import { assertQuestMember, HttpError } from './access.js'
import { recommendForQuest } from './recommendationService.js'

export type PlanItem = { id: string; title: string; kind: 'experience' | 'food' | 'stay' | 'transport' | 'free'; time: string; duration: number; note: string; locked: boolean }
export type PlanDay = { id: string; title: string; items: PlanItem[] }
export type PlanDocument = { title: string; destination: string; country: string; catalogueId: string; days: PlanDay[] }
type Snapshot = { label: string; document: PlanDocument }
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

export async function getWorkingPlan(roomId: string, userId: string) {
  await assertQuestMember(roomId, userId)
  const [row] = await selectRows<PlanRow>('quest_working_plans', columns, [{ column: 'id', operator: 'eq', value: roomId }])
  return row ? describePlan(row) : null
}

export async function startWorkingPlan(roomId: string, userId: string, catalogueId: unknown) {
  await assertPlanEditor(roomId, userId)
  const current = await getWorkingPlan(roomId, userId)
  if (current) return current
  const recommendations = await recommendForQuest(roomId)
  const trip = recommendations.results.find(item => item.id === catalogueId)
  if (!trip) throw new HttpError(409, 'This starting point has changed. Refresh the trip ideas and choose again.')
  const days = (Array.isArray(trip.daily_plan) ? trip.daily_plan : []).map((value, index): PlanDay => {
    const day = value as Record<string, unknown>
    return { id: randomUUID(), title: `Day ${index + 1}`, items: ['morning', 'afternoon', 'evening'].flatMap((slot, slotIndex) => {
      const title = text(day[slot], 180)
      return title ? [{ id: randomUUID(), title: title.charAt(0).toUpperCase() + title.slice(1), kind: /dinner|food|taste|lunch|breakfast/i.test(title) ? 'food' : 'experience', time: ['10:00', '14:00', '19:00'][slotIndex], duration: 90, note: 'Starting idea from the collection. Timing, location and availability need checking.', locked: false } satisfies PlanItem] : []
    }) }
  })
  if (!days.length) throw new HttpError(409, 'This idea has no days yet. Choose another starting point.')
  const document: PlanDocument = { title: `${trip.destination}, together`, destination: trip.destination, country: trip.country, catalogueId: trip.id, days }
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
    Object.assign(item, validateItem(command))
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
  if (input.type === 'undo') {
    if (!history.length) throw new HttpError(409, 'There are no changes to undo.')
    document = history.at(-1)!.document
    history = history.slice(0, -1)
  } else {
    const applied = applyPlanCommand(row.data.document, input)
    document = applied.document
    history = [...history, { label: applied.label, document: row.data.document }].slice(-30)
  }
  const [updated] = await updateRows<PlanRow>('quest_working_plans', { revision: row.revision + 1, updated_at: new Date().toISOString(), data: { document, history, requests: [...row.data.requests, input.requestId].slice(-60) } }, [{ column: 'id', operator: 'eq', value: roomId }, { column: 'revision', operator: 'eq', value: String(row.revision) }], columns)
  if (!updated) throw new HttpError(409, 'Someone saved a change first. Load the latest version and try again.')
  return describePlan(updated)
}
