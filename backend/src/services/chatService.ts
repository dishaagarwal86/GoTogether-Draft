import { randomUUID } from 'node:crypto'
import { supabase } from '../supabase.js'

type UserRow = { id: string; first_name: string | null; last_name: string | null }
type MessageRow = { id: string; sender_id: string; body: string; created_at: string }

const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message) }

async function assertQuestMember(roomId: string, userId: string) {
  const membership = await supabase
    .from('trip_room_people')
    .select('id')
    .eq('trip_room_id', roomId)
    .eq('user_id', userId)
    .eq('invite_status', 'accepted')
    .maybeSingle()
  fail(membership.error)
  if (!membership.data) throw new Error('Only accepted quest members can use this chat.')
}

export async function listQuestMessages(roomId: string, userId: string) {
  await assertQuestMember(roomId, userId)
  const result = await supabase
    .from('trip_room_messages')
    .select('id,sender_id,body,created_at')
    .eq('trip_room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(200)
  fail(result.error)
  const messages = (result.data ?? []) as MessageRow[]
  const senderIds = [...new Set(messages.map((message) => message.sender_id))]
  const people = senderIds.length
    ? await supabase.from('users').select('id,first_name,last_name').in('id', senderIds)
    : { data: [], error: null }
  fail(people.error)
  const names = new Map(((people.data ?? []) as UserRow[]).map((person) => [person.id, `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || 'Traveller']))
  return messages.map((message) => ({
    id: message.id,
    senderId: message.sender_id,
    senderName: names.get(message.sender_id) ?? 'Traveller',
    body: message.body,
    createdAt: message.created_at,
  }))
}

export async function createQuestMessage(roomId: string, userId: string, body: string) {
  await assertQuestMember(roomId, userId)
  const text = body.trim()
  if (!text || text.length > 2000) throw new Error('Messages must be between 1 and 2,000 characters.')
  const result = await supabase
    .from('trip_room_messages')
    .insert({ id: `message_${randomUUID()}`, trip_room_id: roomId, sender_id: userId, body: text })
    .select('id,sender_id,body,created_at')
    .single()
  fail(result.error)
  if (!result.data) throw new Error('Could not save this message.')
  const user = await supabase.from('users').select('first_name,last_name').eq('id', userId).single()
  fail(user.error)
  if (!user.data) throw new Error('Could not find this traveller.')
  return {
    id: result.data.id,
    senderId: result.data.sender_id,
    senderName: `${user.data.first_name ?? ''} ${user.data.last_name ?? ''}`.trim() || 'Traveller',
    body: result.data.body,
    createdAt: result.data.created_at,
  }
}
