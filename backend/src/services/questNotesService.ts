import { randomUUID } from 'node:crypto'
import OpenAI from 'openai'
import { insertRow, selectRows, updateRows, upsertRow } from '../storage.js'
import { createQuestMessage } from './chatService.js'

export type QuestNoteType = 'activity' | 'mood' | 'budget' | 'accommodation' | 'no_go'
export type QuestNote = { id: string; type: QuestNoteType; suggestion: string; proposedAction: string; confidence: number; mentionedBy: string[]; messageIds: string[]; groupSupportCount: number; requiresGroupConfirmation: true; status: 'suggested' | 'accepted' | 'dismissed'; chosenAction: string | null }
type Message = { id: string; sender_id: string; body: string }
const noteColumns = ['id', 'type', 'suggestion', 'proposed_action', 'confidence', 'mentioned_by', 'message_ids', 'group_support_count', 'requires_group_confirmation', 'status', 'chosen_action']
const canonicalSignals: Array<{ type: QuestNoteType; pattern: RegExp; suggestion: string; proposedAction: string }> = [
  { type: 'activity', pattern: /\b(cooking class|cookery class)\b/i, suggestion: 'Make room for a cooking class.', proposedAction: 'Add cooking class as a shared nice-to-have' },
  { type: 'activity', pattern: /\b(food markets?|market breakfast)\b/i, suggestion: 'Include food markets in the plan.', proposedAction: 'Add food markets as a shared nice-to-have' },
  { type: 'mood', pattern: /\b(peaceful|quiet|relaxing|slow days?)\b/i, suggestion: 'Keep the pace peaceful and unhurried.', proposedAction: 'Add slow travel as a shared mood' },
  { type: 'budget', pattern: /\b(under|below|less than)\s*(₹|rs\.?|inr)?\s*\d[\d,]*/i, suggestion: 'Keep the plan within the budget mentioned in chat.', proposedAction: 'Use this as a shared budget guide' },
  { type: 'accommodation', pattern: /\b(apartment|home rental|airbnb)\b/i, suggestion: 'Consider an apartment stay.', proposedAction: 'Add apartment stay as a shared preference' },
  { type: 'no_go', pattern: /\b(early mornings?|nightlife every night|long drives?|crowded places?)\b/i, suggestion: 'Protect this boundary in the plan.', proposedAction: 'Add this as a shared no-go' },
]
async function aiConfirmedTypes(messages: Message[]): Promise<Set<QuestNoteType> | undefined> {
  const provider = process.env.AI_PROVIDER === 'ollama' || process.env.OLLAMA_API_KEY ? 'ollama' : process.env.OPENAI_API_KEY ? 'openai' : undefined
  const apiKey = provider === 'ollama' ? process.env.OLLAMA_API_KEY : process.env.OPENAI_API_KEY
  if (!provider || !apiKey) return undefined
  const client = new OpenAI({ apiKey, ...(provider === 'ollama' ? { baseURL: process.env.OLLAMA_BASE_URL ?? 'https://ollama.com/v1' } : {}) })
  const prompt = `You extract only explicit, actionable group-travel signals from recent opt-in chat messages. Never infer health, identity, relationships, or private form answers. Return JSON only: {"signals":[{"type":"activity|mood|budget|accommodation|no_go","messageIds":["..."]}]}. A signal must be clearly written in the listed messages. Do not add a type if no message supports it.\nMessages: ${JSON.stringify(messages.map((message) => ({ id: message.id, senderId: message.sender_id, body: message.body })))} `
  try {
    const result = await client.responses.create({ model: provider === 'ollama' ? (process.env.OLLAMA_MODEL ?? 'gpt-oss:20b') : (process.env.OPENAI_MODEL ?? 'gpt-5-mini'), input: prompt })
    const parsed = JSON.parse(result.output_text.replace(/^```json\s*|```$/g, '').trim()) as { signals?: Array<{ type?: string; messageIds?: string[] }> }
    const ids = new Set(messages.map((message) => message.id))
    return new Set((parsed.signals ?? []).filter((signal): signal is { type: QuestNoteType; messageIds: string[] } => Boolean(signal.type && ['activity', 'mood', 'budget', 'accommodation', 'no_go'].includes(signal.type) && signal.messageIds?.every((id) => ids.has(id)))).map((signal) => signal.type))
  } catch { return undefined }
}

async function assertMember(roomId: string, userId: string) {
  const [membership] = await selectRows('trip_room_people', ['id'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'user_id', operator: 'eq', value: userId }, { column: 'invite_status', operator: 'eq', value: 'accepted' }])
  if (!membership) throw new Error('Only accepted quest members can use Quest Notes.')
}
function mapNote(row: Record<string, unknown>): QuestNote { return { id: String(row.id), type: row.type as QuestNoteType, suggestion: String(row.suggestion), proposedAction: String(row.proposed_action), confidence: Number(row.confidence), mentionedBy: Array.isArray(row.mentioned_by) ? row.mentioned_by.map(String) : [], messageIds: Array.isArray(row.message_ids) ? row.message_ids.map(String) : [], groupSupportCount: Number(row.group_support_count), requiresGroupConfirmation: true, status: row.status as QuestNote['status'], chosenAction: row.chosen_action == null ? null : String(row.chosen_action) } }

export async function getQuestNotesState(roomId: string, userId: string) {
  await assertMember(roomId, userId)
  const [setting] = await selectRows<{ enabled: boolean }>('quest_note_settings', ['enabled'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }])
  const notes = await selectRows<Record<string, unknown>>('quest_notes', noteColumns, [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'status', operator: 'eq', value: 'suggested' }], { orderBy: 'created_at', ascending: false, limit: 5 })
  return { enabled: Boolean(setting?.enabled), notes: notes.map(mapNote) }
}
export async function setQuestNotesEnabled(roomId: string, userId: string, enabled: boolean) {
  await assertMember(roomId, userId)
  await upsertRow('quest_note_settings', { trip_room_id: roomId, enabled, updated_by: userId, updated_at: new Date().toISOString() }, ['trip_room_id'])
  return { enabled }
}

export async function analyseQuestNotes(roomId: string, userId: string) {
  await assertMember(roomId, userId)
  const [setting] = await selectRows<{ enabled: boolean }>('quest_note_settings', ['enabled'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }])
  if (!setting?.enabled) throw new Error('Enable Quest Notes before analysing the conversation.')
  const messages = await selectRows<Message>('trip_room_messages', ['id', 'sender_id', 'body'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }], { orderBy: 'created_at', ascending: false, limit: 40 })
  const candidates = canonicalSignals.map((signal) => {
    const matches = messages.filter((message) => signal.pattern.test(message.body))
    const memberIds = [...new Set(matches.map((message) => message.sender_id))]
    return { signal, matches, memberIds }
  }).filter((candidate) => candidate.matches.length)
  const confirmedTypes = await aiConfirmedTypes(messages)
  // A bare “yes” is not enough: it must name the same signal, and come from
  // someone other than the original speaker.
  const publicCandidate = candidates.find((candidate) => {
    if (confirmedTypes && !confirmedTypes.has(candidate.signal.type)) return false
    if (candidate.memberIds.length >= 2) return true
    const original = candidate.memberIds[0]
    return messages.some((message) => message.sender_id !== original && /\b(yes|agree|sounds good|let's do it)\b/i.test(message.body) && candidate.signal.pattern.test(message.body))
  })
  if (publicCandidate) {
    const { signal, matches, memberIds } = publicCandidate
    const existing = await selectRows<Record<string, unknown>>('quest_notes', noteColumns, [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'status', operator: 'eq', value: 'suggested' }], { orderBy: 'created_at', ascending: false, limit: 10 })
    const duplicate = existing.map(mapNote).find((note) => note.type === signal.type && note.suggestion === signal.suggestion)
    if (duplicate) return { note: duplicate, privateSuggestion: null }
    const note = await insertRow<Record<string, unknown>>('quest_notes', { id: `quest_note_${randomUUID()}`, trip_room_id: roomId, created_by: userId, type: signal.type, suggestion: signal.suggestion, proposed_action: signal.proposedAction, confidence: Math.min(.95, .6 + memberIds.length * .12), mentioned_by: memberIds, message_ids: matches.map((message) => message.id), group_support_count: memberIds.length, requires_group_confirmation: true }, noteColumns)
    return { note: mapNote(note), privateSuggestion: null }
  }
  const privateCandidate = candidates.find((candidate) => candidate.memberIds.length === 1 && candidate.memberIds[0] === userId)
  if (!privateCandidate) return { note: null, privateSuggestion: null }
  const { signal, matches } = privateCandidate
  return { note: null, privateSuggestion: { type: signal.type, suggestion: signal.suggestion, proposedAction: 'Add this to your own preferences?', confidence: .72, mentionedBy: [userId], messageIds: matches.map((message) => message.id), groupSupportCount: 1, requiresGroupConfirmation: true } }
}

export async function applyQuestNote(roomId: string, userId: string, noteId: string, chosenAction: 'must_have' | 'nice_to_have') {
  await assertMember(roomId, userId)
  const [note] = await updateRows<Record<string, unknown>>('quest_notes', { status: 'accepted', chosen_action: chosenAction, updated_at: new Date().toISOString() }, [{ column: 'id', operator: 'eq', value: noteId }, { column: 'trip_room_id', operator: 'eq', value: roomId }], noteColumns)
  if (!note) throw new Error('That Quest Note is no longer available.')
  const value = mapNote(note)
  const label = value.suggestion.replace(/^(make room for|include|consider|keep|protect)\s+/i, '').replace(/^a\s+/i, '').replace(/[.]$/, '')
  await createQuestMessage(roomId, userId, `Quest Note ✦ Your group added ${label.charAt(0).toUpperCase() + label.slice(1)} as a shared ${chosenAction === 'must_have' ? 'must-have' : 'nice-to-have'}.`)
  return value
}

export async function dismissQuestNote(roomId: string, userId: string, noteId: string) {
  await assertMember(roomId, userId)
  await updateRows('quest_notes', { status: 'dismissed', updated_at: new Date().toISOString() }, [{ column: 'id', operator: 'eq', value: noteId }, { column: 'trip_room_id', operator: 'eq', value: roomId }], ['id'])
  return { ok: true }
}
