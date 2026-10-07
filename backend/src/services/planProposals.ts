import { randomUUID } from 'node:crypto'
import { selectRows } from '../storage.js'
import { HttpError } from './access.js'
import { generateAi } from './aiProvider.js'
import { reserveAiRequest } from './aiHistory.js'
import { applyPlanCommand, assertPlanEditor, getWorkingPlan, type PlanDocument } from './workingPlan.js'
import { fingerprint, getTravelProfile, questPlanningConstraints, requestId, travelAction } from './travelMemory.js'
import { record, text, violatesNoGo } from './travelPreferences.js'

export type ProposalData = { commands: Record<string, unknown>[]; summary: string; changes: Array<{ before: string; after: string }>; source?: string; notice?: string; instruction?: string; durationMs?: number; constraintsFingerprint?: string }
export type PlanJob = { id: string; user_id: string; room_id: string; state: string; base_revision: number; credit_charged: boolean; data: ProposalData; created_at: string }
const jobColumns = ['id', 'user_id', 'room_id', 'state', 'base_revision', 'credit_charged', 'data', 'created_at']
const describe = (plan: PlanDocument) => plan.days.flatMap(day => day.items.map((item, index) => ({ id: item.id, label: `${day.title} · Stop ${index + 1} · ${item.time} · ${item.title} · ${item.duration} min · ${item.kind}${item.note ? ` — ${item.note}` : ''}` })))
export function validateProposal(input: unknown, plan: PlanDocument, noGo: string): ProposalData {
  const value = record(input)
  if (!Array.isArray(value.commands) || !value.commands.length || value.commands.length > 8) throw new Error('A proposal needs between one and eight bounded changes.')
  let next = structuredClone(plan)
  const commands = value.commands.map(raw => {
    const command = record(raw)
    if (!['add', 'remove', 'move', 'update'].includes(String(command.type))) throw new Error('Unsupported proposed change.')
    if (['add', 'update'].includes(String(command.type)) && violatesNoGo(noGo, String(command.title ?? '') + ' ' + String(command.note ?? ''))) throw new Error('This suggestion conflicts with a saved boundary.')
    next = applyPlanCommand(next, command).document
    return command
  })
  const before = describe(plan), after = describe(next)
  const ids = [...new Set([...before, ...after].map(item => item.id))]
  const changes = ids.flatMap(id => {
    const previous = before.find(item => item.id === id), updated = after.find(item => item.id === id)
    return previous?.label !== updated?.label ? [{ before: previous?.label ?? 'New moment', after: updated?.label ?? 'Remove this moment' }] : []
  })
  if (!changes.length) throw new Error('No change to preview.')
  // Resolve server-generated IDs at application time; add commands themselves
  // never accept a client or model supplied item ID as canonical.
  return { commands, summary: text(value.summary, 600), changes }
}
function localSuggestion(plan: PlanDocument, instruction: string, dayId: string | undefined): ProposalData {
  const day = plan.days.find(day => day.id === dayId) ?? plan.days[0]
  const commands: Record<string, unknown>[] = []
  if (/^move unlocked moments one hour later[.!]?$/i.test(instruction.trim())) {
    for (const item of day.items.filter(item => !item.locked && !['transport', 'stay'].includes(item.kind)).slice(0, 8)) {
      const hour = Number(item.time.slice(0, 2)) + 1
      if (hour < 23) commands.push({ type: 'update', itemId: item.id, title: item.title, kind: item.kind, time: `${String(hour).padStart(2, '0')}:${item.time.slice(3)}`, duration: item.duration, note: item.note })
    }
  }
  if (!commands.length) return { commands: [], summary: 'Companion could not prepare a reliable change. Your plan is unchanged; use Edit / replace to shape it yourself.', changes: [] }
  return validateProposal({ commands, summary: `Move the unlocked moments in ${day.title} one hour later. Check overlaps and travel times before applying.` }, plan, '')
}
export async function listPlanProposals(userId: string, roomId: string) {
  await assertPlanEditor(roomId, userId)
  await getTravelProfile(userId) // Recovers expired reservations before readback.
  return selectRows<PlanJob>('travel_ai_jobs', jobColumns, [{ column: 'user_id', operator: 'eq', value: userId }, { column: 'room_id', operator: 'eq', value: roomId }], { orderBy: 'created_at', ascending: false, limit: 5 })
}
export async function proposePlanChange(userId: string, roomId: string, input: unknown) {
  await assertPlanEditor(roomId, userId)
  const value = record(input)
  const instruction = text(value.instruction, 1000)
  const key = requestId(value.requestId)
  if (!Number.isInteger(value.expectedRevision)) throw new HttpError(400, 'A saved plan revision is required.')
  const plan = await getWorkingPlan(roomId, userId)
  if (!plan) throw new HttpError(404, 'Save a starting plan first.')
  const dayId = typeof value.dayId === 'string' ? value.dayId : undefined
  if (dayId && !plan.days.some(day => day.id === dayId)) throw new HttpError(400, 'Choose a day in this plan.')
  const hash = fingerprint([roomId, value.expectedRevision, instruction, dayId])
  // Known requests are resolved before revision validation, including after apply.
  const [known] = await selectRows<PlanJob & { fingerprint: string }>('travel_ai_jobs', [...jobColumns, 'fingerprint'], [{ column: 'user_id', operator: 'eq', value: userId }, { column: 'request_id', operator: 'eq', value: key }])
  if (known) { if (known.fingerprint !== hash) throw new HttpError(409, 'This request ID was used for a different change.'); await getTravelProfile(userId); return (await selectRows<PlanJob>('travel_ai_jobs', jobColumns, [{ column: 'id', operator: 'eq', value: known.id }, { column: 'user_id', operator: 'eq', value: userId }]))[0] }
  if (value.expectedRevision !== plan.revision) throw new HttpError(409, 'Your plan has changed. Load the latest version before asking for suggestions.')
  await reserveAiRequest(userId)
  const reserved = await travelAction<{ job: PlanJob; created: boolean }>(userId, 'reserve', { id: randomUUID(), roomId, requestId: key, fingerprint: hash, revision: plan.revision, data: { instruction } })
  if (!reserved.created) return reserved.job
  const started = Date.now()
  try {
    const constraints = await questPlanningConstraints(roomId)
    const noGo = constraints.noGo
    const fallback = localSuggestion(plan, instruction, dayId)
    const result = await generateAi('Propose changes to this saved travel plan. Return JSON {summary, commands}. At most 8 commands; types: update (itemId,title,kind,time HH:MM,duration minutes,note), remove (itemId), move (itemId,dayId,index), add (dayId,title,kind,time,duration,note). Only use provided day/item IDs. Kinds: experience, food, stay, transport, free. Do not change locked items. Preserve unrelated items. Respect explicit no-go needs. Use the supplied interests and pace when relevant, with the current instruction taking priority over preference defaults. Times and costs are unverified; never claim bookings or feasibility. Do not change trip destination or number of days.', { plan, instruction, selectedDayId: dayId, preferences: constraints.planningPreferences, avoid: ['hiking', 'water activities', 'nightlife', 'early starts', 'long drives', 'crowds', 'remote areas'].filter(activity => violatesNoGo(noGo, activity)) }, output => validateProposal(output, plan, noGo), fallback)
    const data = { ...result.value, source: result.source, notice: result.notice, instruction, durationMs: Date.now() - started, constraintsFingerprint: constraints.fingerprint }
    return (await travelAction<{ job: PlanJob }>(userId, 'finish', { id: reserved.job.id, data, charge: result.source !== 'fallback' && data.commands.length > 0 })).job
  } catch {
    return (await travelAction<{ job: PlanJob }>(userId, 'finish', { id: reserved.job.id, charge: false, data: { commands: [], changes: [], summary: 'This suggestion could not be prepared. Your plan is unchanged and your credit was returned.', source: 'fallback' } })).job
  }
}
