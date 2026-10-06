import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { selectRows, upsertRow, updateRows } from '../storage.js'
import { sendInvitationEmail } from './emailService.js'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')

type InviteRow = { id: string; trip_room_id: string; email: string; status: string; expires_at: Date | string }

export async function listPendingTripRoomInvites(email: string) {
  const invites = await selectRows<InviteRow>('trip_room_invites', ['id', 'trip_room_id', 'email', 'status', 'expires_at'], [
    { column: 'email', operator: 'eq', value: email.trim().toLowerCase() },
    { column: 'status', operator: 'eq', value: 'pending' },
    { column: 'expires_at', operator: 'gt', value: new Date().toISOString() },
  ], { orderBy: 'created_at', ascending: false })
  const roomIds = [...new Set(invites.map((invite) => invite.trip_room_id))]
  const rooms = roomIds.length ? await selectRows<{ id: string; name: string; trip_name: string }>('trip_rooms', ['id', 'name', 'trip_name'], [{ column: 'id', operator: 'in', value: roomIds }]) : []
  const byId = new Map(rooms.map((room) => [room.id, room]))
  return invites.flatMap((invite) => { const room = byId.get(invite.trip_room_id); return room ? [{ id: invite.id, expiresAt: new Date(invite.expires_at).toISOString(), room }] : [] })
}

export async function createTripRoomInvite(room: { id: string; name: string }, email: string) {
  const token = randomBytes(32).toString('hex')
  const invite = { id: `invite_${randomUUID()}`, trip_room_id: room.id, email: email.trim().toLowerCase(), token_hash: hash(token), status: 'pending', expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString() }
  await upsertRow('trip_room_invites', invite, ['trip_room_id', 'email'])
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
  const [invite] = await selectRows<InviteRow>('trip_room_invites', ['id', 'trip_room_id', 'email', 'status', 'expires_at'], [{ column: 'token_hash', operator: 'eq', value: hash(token) }])
  if (!invite || invite.status !== 'pending' || new Date(invite.expires_at).getTime() < Date.now()) return undefined
  const [room] = await selectRows<{ id: string; name: string; trip_name: string }>('trip_rooms', ['id', 'name', 'trip_name'], [{ column: 'id', operator: 'eq', value: invite.trip_room_id }])
  if (!room) return undefined
  return { email: invite.email, expiresAt: new Date(invite.expires_at).toISOString(), room }
}

export async function acceptTripRoomInvite(token: string, user: { id: string; email: string }) {
  const invite = await getTripRoomInvite(token)
  if (!invite) throw new Error('This invitation is no longer available.')
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) throw new Error('Sign in with the email address that received this invitation.')
  const [lookup] = await selectRows<{ id: string; trip_room_id: string }>('trip_room_invites', ['id', 'trip_room_id'], [{ column: 'token_hash', operator: 'eq', value: hash(token) }])
  if (!lookup) throw new Error('This invitation is no longer available.')
  await upsertRow('trip_room_people', { trip_room_id: lookup.trip_room_id, user_id: user.id, role: 'member', invite_status: 'accepted' }, ['trip_room_id', 'user_id'])
  await updateRows('trip_room_invites', { status: 'accepted', accepted_at: new Date().toISOString() }, [{ column: 'id', operator: 'eq', value: lookup.id }], ['id'])
  return invite.room
}

export async function acceptTripRoomInviteById(inviteId: string, user: { id: string; email: string }) {
  const [invite] = await selectRows<InviteRow>('trip_room_invites', ['id', 'trip_room_id', 'email', 'status', 'expires_at'], [{ column: 'id', operator: 'eq', value: inviteId }])
  if (!invite || invite.status !== 'pending' || new Date(invite.expires_at).getTime() < Date.now()) throw new Error('This invitation is no longer available.')
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) throw new Error('This invitation belongs to a different email address.')
  await upsertRow('trip_room_people', { trip_room_id: invite.trip_room_id, user_id: user.id, role: 'member', invite_status: 'accepted' }, ['trip_room_id', 'user_id'])
  await updateRows('trip_room_invites', { status: 'accepted', accepted_at: new Date().toISOString() }, [{ column: 'id', operator: 'eq', value: invite.id }], ['id'])
  return invite.trip_room_id
}
