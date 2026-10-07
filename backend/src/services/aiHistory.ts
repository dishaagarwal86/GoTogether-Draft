import { createHash, randomUUID } from 'node:crypto'
import { deleteRows, insertIfMissing, insertRow, selectRows, type Filter } from '../storage.js'
import { assertQuestMember, HttpError } from './access.js'

export type AiTask = 'extract' | 'group-dna' | 'explain' | 'chat' | 'personalise'
export type AiRecord = { id: string; user_id: string; trip_room_id: string | null; task: AiTask; context_key: string; data: Record<string, unknown>; created_at: string }
const columns = ['id', 'user_id', 'trip_room_id', 'task', 'context_key', 'data', 'created_at']
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]))
  return value
}
export const contextKey = (value: unknown) => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')

// Atomic slots keep this limit consistent across simultaneous requests and API replicas.
export async function reserveAiRequest(userId: string, now = Date.now()) {
  await deleteRows('ai_rate_limits', [{ column: 'user_id', operator: 'eq', value: userId }, { column: 'expires_at', operator: 'lt', value: new Date(now).toISOString() }])
  const bucket = Math.floor(now / 60000)
  for (let slot = 0; slot < 10; slot++) {
    if (await insertIfMissing('ai_rate_limits', { id: contextKey([userId, bucket, slot]), user_id: userId, expires_at: new Date((bucket + 1) * 60000).toISOString() })) return
  }
  throw new HttpError(429, 'The Companion needs a little pause. Try again in a minute.')
}
export async function saveAiRecord(userId: string, roomId: string | undefined, task: AiTask, key: string, data: Record<string, unknown>) {
  return insertRow<AiRecord>('ai_records', { id: `ai_${randomUUID()}`, user_id: userId, trip_room_id: roomId ?? null, task, context_key: key, data }, columns)
}
export async function aiHistory(userId: string, roomId?: string, task?: AiTask, key?: string) {
  if (roomId) await assertQuestMember(roomId, userId)
  const filters: Filter[] = [{ column: 'user_id', operator: 'eq', value: userId }]
  filters.push(roomId ? { column: 'trip_room_id', operator: 'eq', value: roomId } : { column: 'trip_room_id', operator: 'is', value: null })
  if (task) filters.push({ column: 'task', operator: 'eq', value: task })
  if (key) filters.push({ column: 'context_key', operator: 'eq', value: key })
  const records = await selectRows<AiRecord>('ai_records', columns, filters, { orderBy: 'created_at', limit: 50 })
  return records
}
export async function ownedAiRecord(userId: string, id: string) {
  const [item] = await selectRows<AiRecord>('ai_records', columns, [{ column: 'id', operator: 'eq', value: id }, { column: 'user_id', operator: 'eq', value: userId }])
  if (!item) throw new HttpError(404, 'This Companion suggestion is no longer available.')
  if (item.trip_room_id) await assertQuestMember(item.trip_room_id, userId)
  return item
}
