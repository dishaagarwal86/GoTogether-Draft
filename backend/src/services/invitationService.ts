import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { supabase } from '../supabase.js'
import { sendInvitationEmail } from './emailService.js'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message) }

type InviteRow = { id: string; trip_room_id: string; email: string; status: string; expires_at: string }

export async function createTripRoomInvite(room: { id: string; name: string }, email: string) {
  const token = randomBytes(32).toString('hex')
  const invite = { id: `invite_${randomUUID()}`, trip_room_id: room.id, email: email.trim().toLowerCase(), token_hash: hash(token), status: 'pending', expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString() }
  const result = await supabase.from('trip_room_invites').upsert(invite, { onConflict: 'trip_room_id,email' })
  fail(result.error)
  const baseUrl = (process.env.APP_URL ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '')
  const inviteUrl = `${baseUrl}/invite/${token}`
  // Saving a quest and recording its invitation must not be undone by a
  // temporary SMTP/Resend problem. The invitation remains available and can
  // be sent again once email configuration is corrected.
  try {
    const delivery = await sendInvitationEmail({ recipient: invite.email, questName: room.name, inviteUrl })
    return { email: invite.email, delivered: delivery.delivered, reason: delivery.reason, expiresAt: invite.expires_at }
  } catch (error) {
    console.error('Invitation email delivery failed:', error)
    const responseCode = typeof error === 'object' && error !== null && 'responseCode' in error ? (error as { responseCode?: unknown }).responseCode : undefined
    const reason = responseCode === 550
      ? 'Resend is in testing mode and can only send to the account owner. Verify a domain in Resend to invite other email addresses.'
      : 'The invitation was saved, but email delivery could not be completed.'
    return { email: invite.email, delivered: false, reason, expiresAt: invite.expires_at }
  }
}

export async function getTripRoomInvite(token: string) {
  const result = await supabase.from('trip_room_invites').select('id,trip_room_id,email,status,expires_at').eq('token_hash', hash(token)).maybeSingle()
  fail(result.error); const invite = result.data as InviteRow | null
  if (!invite || invite.status !== 'pending' || new Date(invite.expires_at).getTime() < Date.now()) return undefined
  const roomResult = await supabase.from('trip_rooms').select('id,name,trip_name').eq('id', invite.trip_room_id).maybeSingle()
  fail(roomResult.error); if (!roomResult.data) return undefined
  return { email: invite.email, expiresAt: invite.expires_at, room: roomResult.data }
}

export async function acceptTripRoomInvite(token: string, user: { id: string; email: string }) {
  const invite = await getTripRoomInvite(token)
  if (!invite) throw new Error('This invitation is no longer available.')
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) throw new Error('Sign in with the email address that received this invitation.')
  const lookup = await supabase.from('trip_room_invites').select('id,trip_room_id').eq('token_hash', hash(token)).single()
  fail(lookup.error)
  if (!lookup.data) throw new Error('This invitation is no longer available.')
  const membership = await supabase.from('trip_room_people').upsert({ trip_room_id: lookup.data.trip_room_id, user_id: user.id, role: 'member', invite_status: 'accepted' }, { onConflict: 'trip_room_id,user_id' })
  fail(membership.error)
  const update = await supabase.from('trip_room_invites').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', lookup.data.id)
  fail(update.error)
  return invite.room
}
