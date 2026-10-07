import { randomUUID } from 'node:crypto'
import { selectRows, insertRow } from '../storage.js'

type UserRow = { id: string; first_name: string | null; last_name: string | null }
type MessageRow = { id: string; sender_id: string; body: string; created_at: Date | string }
const messageColumns = ['id', 'sender_id', 'body', 'created_at']
const travellerName = (person: UserRow) => `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || 'Traveller'

async function assertQuestMember(roomId: string, userId: string) {
  const [membership] = await selectRows('trip_room_people', ['id'], [
    { column: 'trip_room_id', operator: 'eq', value: roomId },
    { column: 'user_id', operator: 'eq', value: userId },
    { column: 'invite_status', operator: 'eq', value: 'accepted' },
  ])
  if (!membership) throw new Error('Only accepted quest members can use this chat.')
}

export async function listQuestMessages(roomId: string, userId: string) {
  await assertQuestMember(roomId, userId)
  const messages = await selectRows<MessageRow>('trip_room_messages', messageColumns,
    [{ column: 'trip_room_id', operator: 'eq', value: roomId }], { orderBy: 'created_at', limit: 200 })
  messages.reverse()
  const senderIds = [...new Set(messages.map((message) => message.sender_id))]
  const people = senderIds.length ? await selectRows<UserRow>('users', ['id', 'first_name', 'last_name'],
    [{ column: 'id', operator: 'in', value: senderIds }]) : []
  const names = new Map(people.map((person) => [person.id, travellerName(person)]))
  return messages.map((message) => ({
    id: message.id,
    senderId: message.sender_id,
    senderName: names.get(message.sender_id) ?? 'Traveller',
    body: message.body,
    createdAt: new Date(message.created_at).toISOString(),
  }))
}

export async function createQuestMessage(roomId: string, userId: string, body: string) {
  await assertQuestMember(roomId, userId)
  const text = body.trim()
  if (!text || text.length > 2000) throw new Error('Messages must be between 1 and 2,000 characters.')
  const message = await insertRow<MessageRow>('trip_room_messages',
    { id: `message_${randomUUID()}`, trip_room_id: roomId, sender_id: userId, body: text }, messageColumns)
  const [user] = await selectRows<UserRow>('users', ['id', 'first_name', 'last_name'], [{ column: 'id', operator: 'eq', value: userId }])
  if (!user) throw new Error('Could not find this traveller.')
  return {
    id: message.id,
    senderId: message.sender_id,
    senderName: travellerName(user),
    body: message.body,
    createdAt: new Date(message.created_at).toISOString(),
  }
}
