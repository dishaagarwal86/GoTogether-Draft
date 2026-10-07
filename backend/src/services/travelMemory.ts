import { createHash, randomUUID } from 'node:crypto'
import { query } from '../db.js'
import { getDatabaseConfig } from '../databaseConfig.js'
import { getSupabase } from '../supabase.js'
import { selectRows } from '../storage.js'
import { HttpError } from './access.js'
import { moodName, moods, normalize, paces, record, strings, text } from './travelPreferences.js'
import type { PlanDocument, PlanItem } from './workingPlan.js'

export const tripContexts = ['leisure', 'solo', 'partner', 'friends', 'family', 'work']
export type Memory = { id: string; feature: 'day_start' | 'pace' | 'interest' | 'avoid_activity'; value: string; context: string; source: 'edit' | 'import' | 'manual'; event_id: string | null; import_id: string | null; created_at: string }
export type TravelProfile = {
  settings: { learningEnabled: boolean; useEnabled: boolean };
  memories: Memory[];
  wallet: { points: number; credits: number; reserved: number };
  imports: Array<{ id: string; status: string; title: string; destination: string; endDate: string; awardedPoints: number }>;
  ledger: Array<{ kind: string; points_delta: number; credits_delta: number; created_at: string }>;
  importId?: string; awardedPoints?: number;
}
export type LearningSignal = { feature: Memory['feature']; value: string; label: string }
export const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const requestId = (value: unknown) => { if (typeof value !== 'string' || !/^[\w-]{12,80}$/.test(value)) throw new HttpError(400, 'A unique request ID is required.'); return value }
export function contextFor(value: unknown) { const context = normalize(typeof value === 'string' ? value : ''); return tripContexts.includes(context) ? context : 'leisure' }
export function memoryContext(value: unknown) { if (value !== 'any' && !tripContexts.includes(String(value))) throw new HttpError(400, 'Choose a trip context.'); return String(value) }

// Both providers execute the same PostgreSQL transaction functions.
export async function travelRpc<T>(name: 'travel_action' | 'commit_travel_plan', args: Record<string, unknown>): Promise<T> {
  try {
    if (getDatabaseConfig().provider === 'supabase') {
      const { data, error } = await getSupabase().rpc(name, args)
      if (error) throw new Error(error.message)
      return data as T
    }
    const keys = Object.keys(args)
    if (keys.some(key => !/^p_[a-z_]+$/.test(key))) throw new Error('Invalid RPC argument.')
    const values = Object.values(args).map(value => value && typeof value === 'object' ? JSON.stringify(value) : value)
    return (await query<{ result: T }>(`select ${name}(${keys.map((key, index) => `${key} => $${index + 1}`).join(',')}) as result`, values)).rows[0].result
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('TRAVEL: ')) throw new HttpError(409, message.split('TRAVEL: ')[1])
    throw error
  }
}
export const travelAction = <T = TravelProfile>(userId: string, action: string, input: Record<string, unknown> = {}) => travelRpc<T>('travel_action', { p_user: userId, p_action: action, p_input: input })
export const getTravelProfile = (userId: string) => travelAction(userId, 'read')

export function effectiveMemories(profile: TravelProfile, context: string) {
  if (!profile.settings.useEnabled) return { interests: [] as string[], avoid: [] as string[], dayStart: '', pace: '' }
  // Context-specific confirmed facts win over general defaults. Within a scope,
  // the latest explicit confirmation wins; observations are never auto-confirmed.
  const matches = profile.memories.filter(item => item.context === context || item.context === 'any')
    .sort((a, b) => Number(b.context === context) - Number(a.context === context) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
  return { interests: [...new Set(matches.filter(item => item.feature === 'interest').map(item => item.value))].slice(0, 3), avoid: [...new Set(matches.filter(item => item.feature === 'avoid_activity').map(item => item.value))], dayStart: matches.find(item => item.feature === 'day_start')?.value ?? '', pace: matches.find(item => item.feature === 'pace')?.value ?? '' }
}
export function validateMemory(input: unknown) {
  const value = record(input)
  const feature = text(value.feature, 30) as Memory['feature']
  const preference = text(value.value, 100)
  if (feature === 'day_start' ? !/^(?:0[5-9]|1[0-4]):[0-5]\d$/.test(preference)
    : feature === 'pace' ? !paces.includes(preference)
    : feature === 'interest' ? !moods.includes(preference)
    : feature === 'avoid_activity' ? !['hiking', 'water activities', 'nightlife', 'early starts', 'long drives', 'crowds'].includes(preference)
    : true) throw new HttpError(400, 'Choose a supported travel preference.')
  return { id: randomUUID(), feature, value: preference, context: memoryContext(value.context) }
}
export async function updateTravelSettings(userId: string, input: unknown) {
  const value = record(input)
  for (const key of Object.keys(value)) if (!['learningEnabled', 'useEnabled'].includes(key) || typeof value[key] !== 'boolean') throw new HttpError(400, 'Invalid travel-style setting.')
  return travelAction(userId, 'settings', value)
}
export async function rememberEdit(userId: string, input: unknown) {
  const value = record(input)
  return travelAction(userId, 'remember', { eventId: text(value.eventId, 250), context: memoryContext(value.context) })
}

export function signalFromEdit(before: PlanDocument, after: PlanDocument, command: Record<string, unknown>): LearningSignal | null {
  if (command.type === 'update') {
    const day = before.days.find(day => day.items.some(item => item.id === command.itemId))
    const previous = day?.items.find(item => item.id === command.itemId)
    const next = after.days.flatMap(day => day.items).find(item => item.id === command.itemId)
    const earliest = day?.items.filter(item => !['transport', 'stay'].includes(item.kind)).sort((a, b) => a.time.localeCompare(b.time))[0]
    if (previous && next && previous.id === earliest?.id && previous.time !== next.time && /^(?:0[5-9]|1[0-4]):[0-5]\d$/.test(next.time)) return { feature: 'day_start', value: next.time, label: `Start unbooked days around ${next.time}` }
  }
  if (command.type === 'add') {
    const title = String(command.title ?? '').toLowerCase()
    const interest = command.kind === 'food' || /cooking|food|culture|craft/.test(title) ? 'Food & Culture' : /museum|history/.test(title) ? 'History' : /garden|forest|nature/.test(title) ? 'Nature' : ''
    if (interest) return { feature: 'interest', value: interest, label: `More ${interest.toLowerCase()} on future trips` }
  }
  if (command.type === 'remove') {
    const previous = before.days.flatMap(day => day.items).find(item => item.id === command.itemId)
    if (previous && /\b(hike|hiking|trek|trail)\b/i.test(previous.title)) return { feature: 'avoid_activity', value: 'hiking', label: 'Prefer trips without hiking' }
  }
  return null
}
export async function learningPrompt(userId: string, eventId: string) {
  const profile = await getTravelProfile(userId)
  if (!profile.settings.learningEnabled) return null
  const [event] = await selectRows<{ data: { signal?: LearningSignal; context: string }; reversed: boolean }>('travel_edit_events', ['data', 'reversed'], [{ column: 'id', operator: 'eq', value: eventId }, { column: 'user_id', operator: 'eq', value: userId }])
  const signal = event?.data.signal
  if (!signal || event.reversed || profile.memories.some(item => item.feature === signal.feature && item.value === signal.value && [event.data.context, 'any'].includes(item.context))) return null
  return { eventId, ...signal, context: event.data.context }
}
export async function questPersonalContext(userId: string, roomId: string) {
  const [preference] = await selectRows<{ data: { companions?: string; dayStart?: string; personalizationEnabled?: boolean } }>('preferences', ['data'], [{ column: 'user_id', operator: 'eq', value: userId }, { column: 'trip_room_id', operator: 'eq', value: roomId }], { orderBy: 'updated_at', limit: 1 })
  const context = contextFor(preference?.data?.companions)
  const profile = await getTravelProfile(userId)
  const effective = effectiveMemories(profile, context)
  return { context, profile, effective: preference?.data?.personalizationEnabled === false ? { interests: [], avoid: [], dayStart: '', pace: '' } : effective, explicitStart: preference?.data?.dayStart ?? '' }
}
export async function questPlanningConstraints(roomId: string) {
  const [preferences, members, notes] = await Promise.all([
    selectRows<{ user_id: string; data: Record<string, unknown>; mood_preferences: string[] | null; budget: string | null }>('preferences', ['user_id', 'data', 'mood_preferences', 'budget', 'days_count', 'activities_must_have', 'activities_preferred', 'accommodation_preferences', 'location_preferences'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }]),
    selectRows<{ user_id: string }>('trip_room_people', ['user_id'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'invite_status', operator: 'eq', value: 'accepted' }]),
    selectRows<{ suggestion: string }>('quest_notes', ['suggestion'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'status', operator: 'eq', value: 'accepted' }, { column: 'type', operator: 'eq', value: 'no_go' }]),
  ])
  const accepted = new Set(members.map(member => member.user_id))
  const facts = await Promise.all(preferences.filter(item => accepted.has(item.user_id)).map(async preference => {
    const memory = preference.data?.personalizationEnabled === false ? null : effectiveMemories(await getTravelProfile(preference.user_id), contextFor(preference.data?.companions))
    return { user: preference.user_id, data: preference.data, preference, memory }
  }))
  const noGo = [...facts.flatMap(item => [String(item.data?.noGo ?? ''), ...(item.memory?.avoid ?? [])]), ...notes.map(note => note.suggestion)].filter(Boolean).join('; ')
  return { noGo, planningPreferences: { interests: [...new Set(facts.flatMap(item => item.preference.mood_preferences?.length ? item.preference.mood_preferences : item.memory?.interests ?? []))], paces: [...new Set(facts.map(item => item.data?.pace || item.memory?.pace).filter(Boolean))], budgets: [...new Set(facts.map(item => item.preference.budget).filter(Boolean))] }, fingerprint: fingerprint([facts.sort((a, b) => a.user.localeCompare(b.user)), notes.map(note => note.suggestion).sort()]) }
}
export function applyStartPreference(days: Array<{ items: PlanItem[] }>, time: string) {
  if (!time) return
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  for (const day of days) {
    // Catalogue times are explicitly unconfirmed. Shift a whole unlocked day,
    // preserving gaps; do not alter locked items, transfers, or midnight boundaries.
    if (day.items.some(item => item.locked || item.kind === 'transport')) continue
    const start = Math.min(...day.items.map(item => minutes(item.time)))
    const delta = minutes(time) - start
    if (!Number.isFinite(delta) || day.items.some(item => minutes(item.time) + delta < 0 || minutes(item.time) + delta + item.duration > 1440)) continue
    for (const item of day.items) { const value = minutes(item.time) + delta; item.time = `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` }
  }
}

export type PastTrip = { title: string; destination: string; endDate: string; context: string; days: Array<{ title: string; notes: string }>; reflection: string; loved: string[]; pace: string; dayStart: string }
export function parsePastTrip(input: unknown): PastTrip {
  const value = record(input)
  const pasted = text(value.text, 10000)
  // No external extraction: normalize only what the user pasted, then review.
  const chunks = pasted.split(/\n(?=day\s+\d+\b)/i).filter(value => value.trim())
  if (chunks.length > 30 || chunks.some(chunk => chunk.trim().length > 1500)) throw new HttpError(400, 'Use up to 30 Day headings, with at most 1,500 characters per day. Your pasted text has not been changed.')
  return { title: 'A chapter worth remembering', destination: '', endDate: '', context: 'leisure', days: chunks.map((chunk, index) => ({ title: `Day ${index + 1}`, notes: chunk.trim() })), reflection: '', loved: [], pace: '', dayStart: '' }
}
export async function draftPastTrip(userId: string, input: unknown) {
  const data = parsePastTrip(input)
  const id = randomUUID()
  await travelAction(userId, 'import_draft', { id, data })
  return { id, ...data }
}
export async function getPastTrip(userId: string, id: string) {
  const [trip] = await selectRows<{ id: string; data: PastTrip; status: string }>('travel_imports', ['id', 'data', 'status'], [{ column: 'id', operator: 'eq', value: id }, { column: 'user_id', operator: 'eq', value: userId }])
  if (!trip) throw new HttpError(404, 'This past trip is unavailable.')
  return { id: trip.id, ...trip.data, status: trip.status }
}
export async function savePastTripDraft(userId: string, id: string, input: unknown) {
  const value = record(input)
  const limited = (key: string, max: number) => { if (typeof value[key] !== 'string' || value[key].length > max) throw new HttpError(400, 'This draft contains an invalid field.'); return value[key] }
  if (!Array.isArray(value.days) || !value.days.length || value.days.length > 30) throw new HttpError(400, 'Review between 1 and 30 days.')
  const data = { title: limited('title', 100), destination: limited('destination', 100), endDate: limited('endDate', 10), context: contextFor(value.context), reflection: limited('reflection', 1000), loved: strings(value.loved, 3, 40), pace: limited('pace', 60), dayStart: limited('dayStart', 5), days: value.days.map((day, index) => { const notes = record(day).notes; if (typeof notes !== 'string' || notes.length > 1500) throw new HttpError(400, 'Keep each day under 1,500 characters.'); return { title: `Day ${index + 1}`, notes } }) }
  await travelAction(userId, 'import_update', { id, data })
  return { id, ...data, status: 'draft' }
}
export async function confirmPastTrip(userId: string, id: string, input: unknown) {
  const original = await getPastTrip(userId, id)
  if (original.status === 'confirmed') return getTravelProfile(userId)
  const value = record(input)
  if (value.completed !== true || value.mine !== true) throw new HttpError(400, 'Confirm this is your own completed trip before contributing it.')
  const endDate = text(value.endDate, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || !Number.isFinite(Date.parse(endDate)) || new Date(endDate).toISOString().slice(0, 10) !== endDate || endDate >= new Date().toISOString().slice(0, 10) || endDate < '1970-01-01') throw new HttpError(400, 'Choose a real completion date in the past.')
  if (!Array.isArray(value.days) || !value.days.length || value.days.length > 30) throw new HttpError(400, 'Review between 1 and 30 days.')
  const loved = strings(value.loved, 3, 40).map(moodName)
  if (loved.some(item => !moods.includes(item))) throw new HttpError(400, 'Choose supported interests.')
  const data: PastTrip = { title: text(value.title, 100), destination: text(value.destination, 100), endDate, context: contextFor(value.context), days: value.days.map((day, index) => ({ title: `Day ${index + 1}`, notes: text(record(day).notes, 1500) })), reflection: text(value.reflection, 1000), loved, pace: typeof value.pace === 'string' ? value.pace : '', dayStart: typeof value.dayStart === 'string' ? value.dayStart : '' }
  if (data.reflection.length < 20 || data.days.map(day => day.notes).join(' ').length < 40) throw new HttpError(400, 'Add a little more detail about the trip and what you would repeat or change.')
  const profile = await getTravelProfile(userId)
  const memories: ReturnType<typeof validateMemory>[] = []
  if (value.remember === true && profile.settings.learningEnabled) {
    for (const interest of loved) memories.push(validateMemory({ feature: 'interest', value: interest, context: data.context }))
    if (data.pace) memories.push(validateMemory({ feature: 'pace', value: data.pace, context: data.context }))
    if (data.dayStart) memories.push(validateMemory({ feature: 'day_start', value: data.dayStart, context: data.context }))
  }
  // One contribution per destination/completion date, even after source deletion.
  const key = fingerprint([normalize(data.destination), data.endDate])
  const content = normalize(data.days.map(day => day.notes).join(' '))
  const memberships = await selectRows<{ trip_room_id: string }>('trip_room_people', ['trip_room_id'], [{ column: 'user_id', operator: 'eq', value: userId }, { column: 'invite_status', operator: 'eq', value: 'accepted' }])
  const plans = memberships.length ? await selectRows<{ data: { document: PlanDocument } }>('quest_working_plans', ['data'], [{ column: 'id', operator: 'in', value: memberships.map(item => item.trip_room_id) }]) : []
  // Conservative known-copy check, not proof of travel. App-planned trip
  // reflections can be saved, but exported drafts alone do not mint rewards.
  const copiedPlan = plans.some(plan => {
    const titles = [...new Set(plan.data.document.days.flatMap(day => day.items).map(item => normalize(item.title)).filter(title => title.length >= 12))]
    return titles.length >= 3 && titles.filter(title => content.includes(title)).length >= titles.length * .8
  })
  return travelAction(userId, 'import_confirm', { id, data, fingerprint: key, contentFingerprint: fingerprint(content), rewardEligible: !copiedPlan, memories })
}
