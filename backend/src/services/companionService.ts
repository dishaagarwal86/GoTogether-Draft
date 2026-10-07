import { selectRows, updateRows } from '../storage.js'
import * as entities from './apiStore.js'
import { assertQuestMember, HttpError } from './access.js'
import { aiHistory, contextKey, ownedAiRecord, reserveAiRequest, saveAiRecord, type AiTask } from './aiHistory.js'
import { generateAi } from './aiProvider.js'
import { recommendForQuest } from './recommendationService.js'
import { listQuestMessages } from './chatService.js'
import { getWorkingPlan } from './workingPlan.js'
import { budgets, moods, paces, record, strings, text, validateExtracted, type ExtractedPreferences } from './travelPreferences.js'

export type CompanionTask = Exclude<AiTask, 'personalise'>
type CompanionRequest = { task: CompanionTask; message?: string; roomId?: string; itineraryId?: string; preferences?: Record<string, unknown>; includeCrew?: boolean }
type Place = { name: string; tag: string; reason: string }
type Reply = { summary: string; extracted?: ExtractedPreferences; places?: Place[] }
const answerKeys = ['startDate', 'endDate', 'flexibleDates', 'tripLength', 'groupSize', 'destinationScope', 'destination', 'budget', 'tripFeeling', 'stayStyle', 'mustHave', 'niceToHave', 'noGo', 'pace', 'discovery', 'companions', 'ageGroups', 'priorities', 'dates', 'daysCount', 'moodPreferences', 'activitiesMustHave', 'activitiesPreferred', 'accommodationPreferences']

export function cleanPreferences(value: unknown): Record<string, unknown> {
  const input = record(value ?? {})
  const output: Record<string, unknown> = {}
  for (const key of answerKeys) {
    const item = input[key]
    if (item === undefined || item === null || item === '') continue
    if (Array.isArray(item)) output[key] = strings(item, 12, 150)
    else if (typeof item === 'string') output[key] = text(item, 1000)
    else if (key === 'daysCount' && Number.isInteger(item) && Number(item) > 0 && Number(item) <= 30) output[key] = item
  }
  if (JSON.stringify(output).length > 12000) throw new HttpError(400, 'These travel preferences are too long.')
  return output
}
export function parseCompanionRequest(value: unknown): CompanionRequest {
  const input = record(value)
  if (!['extract', 'group-dna', 'explain', 'chat'].includes(String(input.task))) throw new HttpError(400, 'A valid Companion task is required.')
  const task = input.task as CompanionTask
  const roomId = input.roomId === undefined ? undefined : text(input.roomId, 150)
  const message = input.message === undefined ? undefined : text(input.message, 4000)
  if (['extract', 'chat'].includes(task) && !message) throw new HttpError(400, 'Tell the Companion what you would like to plan.')
  if (task !== 'group-dna' && !roomId) throw new HttpError(400, 'Open a quest before using the Companion.')
  if (input.includeCrew !== undefined && typeof input.includeCrew !== 'boolean') throw new HttpError(400, 'Invalid crew conversation selection.')
  const itineraryId = input.itineraryId === undefined ? undefined : text(input.itineraryId, 150)
  if (task === 'explain' && !itineraryId) throw new HttpError(400, 'Choose an itinerary to explain.')
  return { task, message, roomId, itineraryId, includeCrew: input.includeCrew === true, preferences: task === 'group-dna' ? cleanPreferences(input.preferences) : undefined }
}
async function ownPreference(userId: string, roomId: string) {
  const [item] = await selectRows<{ id: string; data: Record<string, unknown>; updated_at: string | Date }>('preferences', ['id', 'data', 'updated_at'], [{ column: 'user_id', operator: 'eq', value: userId }, { column: 'trip_room_id', operator: 'eq', value: roomId }], { orderBy: 'updated_at', limit: 1 })
  return item ? { ...item, updated_at: new Date(item.updated_at).toISOString() } : undefined
}
export function fallbackExtraction(message: string): ExtractedPreferences {
  const noGo = message.match(/(?:\bavoid\b|\bskip\b|\bno\b)\s+[^.!?;\n]+/gi)?.join('; ')
  const wanted = message.replace(/(?:\bavoid\b|\bskip\b|\bno\b)\s+[^.!?;\n]+/gi, '').toLowerCase()
  const extracted: ExtractedPreferences = {}
  const matches = moods.filter(mood => mood === 'Food & Culture' ? /food|culture/.test(wanted) : wanted.includes(mood.toLowerCase())).slice(0, 3)
  if (matches.length) extracted.moods = matches
  if (/budget.friendly|low budget|on a budget/.test(wanted)) extracted.budget = 'Budget-friendly'
  else if (/premium/.test(wanted)) extracted.budget = 'Premium'
  if (/slow|relaxed/.test(wanted)) extracted.pace = 'Slow & relaxed'
  const duration = wanted.match(/\b(\d{1,2})\s+days?\b/)
  if (duration && Number(duration[1]) > 0 && Number(duration[1]) <= 30) extracted.daysCount = Number(duration[1])
  if (noGo) extracted.noGo = noGo.slice(0, 1000)
  return extracted
}
export function validateReply(value: unknown, task: CompanionTask): Reply {
  const parsed = record(value)
  const allowedKeys = ['summary', ...(task === 'extract' ? ['extracted'] : []), ...(task === 'group-dna' ? ['places'] : [])]
  if (Object.keys(parsed).some(key => !allowedKeys.includes(key))) throw new Error('Unexpected AI response field.')
  const summary = text(parsed.summary, 3000)
  if (task === 'extract') return { summary, extracted: validateExtracted(parsed.extracted) }
  if (task === 'group-dna') {
    const raw = Array.isArray(parsed.places) ? parsed.places : []
    const places: Place[] = raw.slice(0, 3).map((item: unknown) => {
      const p = record(item ?? {})
      return { name: text(p.name, 80), tag: text(p.tag, 40), reason: text(p.reason, 200) }
    }).filter((p: Place) => p.name)
    return { summary, places }
  }
  return { summary }
}
export async function askCompanion(userId: string, input: unknown) {
  const request = parseCompanionRequest(input)
  if (request.roomId) await assertQuestMember(request.roomId, userId)
  const own = request.roomId ? await ownPreference(userId, request.roomId) : undefined
  const plan = request.roomId ? await recommendForQuest(request.roomId) : undefined
  const trip = request.itineraryId ? plan?.results.find(item => item.id === request.itineraryId) : undefined
  if (request.itineraryId && !trip) throw new HttpError(409, 'This itinerary no longer matches the quest. Refresh your travel ideas.')
  const history = request.task === 'chat' ? (await aiHistory(userId, request.roomId, 'chat')).slice(0, 6).reverse().map(item => ({ message: item.data.message, summary: item.data.summary })) : []
  const crew = request.includeCrew && request.roomId ? (await listQuestMessages(request.roomId, userId)).slice(-20).map(item => ({ traveller: item.senderName, message: item.body })) : undefined
  const workingPlan = request.task === 'chat' && request.roomId ? await getWorkingPlan(request.roomId, userId) : undefined
  const context = { preferences: request.preferences ?? cleanPreferences(own?.data), group: plan?.travelDna, itineraries: trip ? [trip] : plan?.results, workingPlan, blockers: plan?.blockers, history, crew }
  const key = contextKey({ task: request.task, roomId: request.roomId, context, message: request.message })
  await reserveAiRequest(userId)
  const fallback: Reply = request.task === 'extract'
    ? { summary: 'Review these suggestions from your notes. Only the fields you select will update your own preferences.', extracted: fallbackExtraction(request.message!) }
    : request.task === 'explain' && trip
      ? { summary: trip.destination + ': ' + (trip.matchedPreferences.join(', ') || 'a catalogue idea within the saved limits') + '. ' + trip.compromises.join(' ') }
      : (() => { const destinations = plan?.results.map(item => item.destination) ?? []; return { summary: plan?.blockers.length ? plan.blockers.join(' ') : destinations.length ? `Destinations to explore: ${destinations.join(', ')}.` : 'Start with your preferred pace, budget, and must-do activities.', places: destinations.slice(0, 3).map(name => ({ name, tag: 'Match', reason: 'Fits your saved preferences.' })) } })()
  const instructions = 'You are the GoTogether Companion. Give warm, concise travel advice grounded in the supplied context. Never calculate or invent scores, edit preferences, make bookings, or claim an action has been saved. Explain conflicts honestly. Task: ' + request.task +
    (request.task === 'group-dna'
      ? '. Return JSON: {"summary":"one sentence intro","places":[{"name":"City or Region","tag":"one mood tag like Adventure or Beach or Culture","reason":"one sentence why it fits"}]} — suggest exactly 3 places that match the preferences. No markdown, no explanation.'
      : '. Return {"summary":"text"}' + (request.task === 'extract' ? ' with an additional "extracted" object containing only preferences explicitly supported by the notes. Allowed keys: moods (up to 3 of ' + moods.join(', ') + '), budget (' + budgets.join(', ') + '), pace (' + paces.join(', ') + '), mustHave (text), noGo (text), daysCount (integer 1 to 30). Omit unknown or ambiguous values. The user will review each field.' : '.'))
  const result = await generateAi(instructions, { message: request.message, context }, value => validateReply(value, request.task), fallback)
  const saved = await saveAiRecord(userId, request.roomId, request.task, key, { ...result.value, source: result.source, notice: result.notice, message: request.message, preferences: request.preferences, itineraryId: request.itineraryId, planVersion: plan?.preferenceVersion, preferenceId: own?.id, preferenceVersion: own && contextKey(own.data) })
  return { id: saved.id, ...result.value, source: result.source, notice: result.notice }
}

export async function applySuggestion(userId: string, recordId: string, fields: unknown) {
  const saved = await ownedAiRecord(userId, recordId)
  if (saved.task !== 'extract' || !saved.trip_room_id) throw new HttpError(400, 'Choose a preference suggestion for this quest.')
  const selected = strings(fields, 6, 30)
  if (!selected.length) throw new HttpError(400, 'Select at least one preference to apply.')
  const suggestions = validateExtracted(saved.data.extracted)
  if (selected.some(key => !(key in suggestions))) throw new HttpError(400, 'Select only preferences in this suggestion.')
  const own = await ownPreference(userId, saved.trip_room_id)
  if (!own || own.id !== saved.data.preferenceId) throw new HttpError(409, 'Save your own preferences first, then ask the Companion again.')
  if (saved.data.applied) return { preferenceId: own.id }
  if (contextKey(own.data) !== saved.data.preferenceVersion) throw new HttpError(409, 'Your preferences changed since this suggestion. Shape your notes again before applying it.')
  const names: Record<string, string> = { moods: 'moodPreferences', budget: 'budget', pace: 'pace', mustHave: 'activitiesMustHave', noGo: 'noGo', daysCount: 'daysCount' }
  const changes = Object.fromEntries(selected.map(key => [names[key], suggestions[key as keyof ExtractedPreferences]]))
  if (!await entities.update('preferences', own.id, changes, own.data)) throw new HttpError(409, 'Your preferences changed while applying this suggestion. Shape your notes again.')
  await updateRows('ai_records', { data: { ...saved.data, applied: true, appliedFields: selected } }, [{ column: 'id', operator: 'eq', value: saved.id }, { column: 'user_id', operator: 'eq', value: userId }], ['id'])
  return { preferenceId: own.id }
}
