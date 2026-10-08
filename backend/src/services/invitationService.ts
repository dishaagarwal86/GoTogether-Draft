import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { selectRows, insertRow, upsertRow, updateRows } from '../storage.js'
import { validatePreferencePayload } from './preferenceValidation.js'
import { preferencesComplete, preferenceFromAnswers, questParticipants } from './questParticipants.js'
import { HttpError } from './access.js'
import { getQuestJourney, respondToJourney } from './questJourney.js'
import { create } from './apiStore.js'
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new HttpError(400, 'Enter a valid email address.')
  const [existing] = await selectRows<{ id: string; status: string }>('trip_room_invites', ['id', 'status'], [{ column: 'trip_room_id', operator: 'eq', value: room.id }, { column: 'email', operator: 'eq', value: email.trim().toLowerCase() }])
  if (existing?.status === 'accepted') {
    const [person] = await selectRows<{ id: string }>('users', ['id'], [{ column: 'email', operator: 'eq', value: email.trim().toLowerCase() }])
    const [joined] = person ? await selectRows('trip_room_people', ['id'], [{ column: 'trip_room_id', operator: 'eq', value: room.id }, { column: 'user_id', operator: 'eq', value: person.id }, { column: 'invite_status', operator: 'eq', value: 'accepted' }]) : []
    if (joined) throw new HttpError(409, 'This person has already joined your quest.')
  }
  const token = randomBytes(32).toString('hex')
  const invite = { id: existing?.id ?? `invite_${randomUUID()}`, trip_room_id: room.id, email: email.trim().toLowerCase(), token_hash: hash(token), status: 'pending', expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString() }
  await upsertRow('trip_room_invites', invite, ['trip_room_id', 'email'])
  const baseUrl = (process.env.APP_URL ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '')
  const inviteUrl = `${baseUrl}/join/${token}`
  // Saving a quest and recording its invitation must not be undone by a
  // temporary SMTP/Resend problem. The invitation remains available and can
  // be sent again once email configuration is corrected.
  try {
    const delivery = await sendInvitationEmail({ recipient: invite.email, questName: room.name, inviteUrl })
    return { inviteUrl, email: invite.email, delivered: delivery.delivered, reason: delivery.reason, expiresAt: invite.expires_at }
  } catch (error) {
    console.error('Invitation email delivery failed:', error)
    const responseCode = typeof error === 'object' && error !== null && 'responseCode' in error ? (error as { responseCode?: unknown }).responseCode : undefined
    const reason = responseCode === 550
      ? 'Resend is in testing mode and can only send to the account owner. Verify a domain in Resend to invite other email addresses.'
      : 'The invitation was saved, but email delivery could not be completed.'
    return { inviteUrl, email: invite.email, delivered: false, reason, expiresAt: invite.expires_at }
  }
}

export async function getTripRoomInvite(token: string) {
  const [invite] = await selectRows<InviteRow>('trip_room_invites', ['id', 'trip_room_id', 'email', 'status', 'expires_at'], [{ column: 'token_hash', operator: 'eq', value: hash(token) }])
  if (!invite || invite.status !== 'pending' || new Date(invite.expires_at).getTime() < Date.now()) return undefined
  const [room] = await selectRows<{ id: string; name: string; trip_name: string; members: number }>('trip_rooms', ['id', 'name', 'trip_name', 'members'], [{ column: 'id', operator: 'eq', value: invite.trip_room_id }])
  if (!room) return undefined
  const [owner] = await selectRows<{ user_id: string }>('trip_room_people', ['user_id'], [{ column: 'trip_room_id', operator: 'eq', value: room.id }, { column: 'role', operator: 'eq', value: 'owner' }])
  const [organiser] = owner ? await selectRows<{ first_name: string | null; last_name: string | null }>('users', ['first_name', 'last_name'], [{ column: 'id', operator: 'eq', value: owner.user_id }]) : []
  const organiserName = organiser ? `${organiser.first_name ?? ''} ${organiser.last_name ?? ''}`.trim() || 'Your organiser' : 'Your organiser'
  const group = await questParticipants(room.id)
  return { email: invite.email, expiresAt: new Date(invite.expires_at).toISOString(), room, organiserName, memberCount: group.totalMembers, completedPreferences: group.completedMembers }
}

export async function saveGuestInvitePreferences(token: string, sessionId: string, answers: Record<string, unknown>) {
  if (!/^[a-f0-9-]{20,}$/i.test(sessionId)) throw new Error('Your guest session is invalid. Reopen the invitation and try again.')
  const invite = await getTripRoomInvite(token)
  if (!invite) throw new Error('This invitation is no longer available.')
  const [lookup] = await selectRows<{ id: string }>('trip_room_invites', ['id'], [{ column: 'token_hash', operator: 'eq', value: hash(token) }])
  if (!lookup) throw new Error('This invitation is no longer available.')
  const data = validatePreferencePayload({ ...answers, submitted: true })
  if (!preferencesComplete(preferenceFromAnswers(`guest:${lookup.id}`, data))) throw new HttpError(400, 'Confirm your dates, trip length, budget, interests and pace first.')
  await upsertRow('guest_invite_preferences', { id: `guest_pref_${randomUUID()}`, invite_id: lookup.id, session_hash: hash(sessionId), data, status: 'submitted', updated_at: new Date().toISOString() }, ['invite_id', 'session_hash'])
  return { roomId: invite.room.id }
}

export async function claimGuestInvitePreferences(token: string, sessionId: string, user: { id: string; email: string }) {
  const invite = await getTripRoomInvite(token)
  if (!invite) throw new Error('This invitation is no longer available.')
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) throw new Error('Sign in with the email address that received this invitation.')
  const [lookup] = await selectRows<{ id: string }>('trip_room_invites', ['id'], [{ column: 'token_hash', operator: 'eq', value: hash(token) }])
  const [guest] = lookup ? await selectRows<{ id: string; data: Record<string, unknown>; status: string }>('guest_invite_preferences', ['id', 'data', 'status'], [{ column: 'invite_id', operator: 'eq', value: lookup.id }, { column: 'session_hash', operator: 'eq', value: hash(sessionId) }]) : []
  if (!lookup || !guest || guest.status !== 'submitted') throw new Error('We could not find your saved guest preferences.')
  await create('preferences', 'preference', { ...guest.data, userId: user.id, tripRoomId: invite.room.id })
  await upsertRow('trip_room_people', { trip_room_id: invite.room.id, user_id: user.id, role: 'member', invite_status: 'accepted' }, ['trip_room_id', 'user_id'])
  await updateRows('trip_room_invites', { status: 'accepted', accepted_at: new Date().toISOString() }, [{ column: 'id', operator: 'eq', value: lookup.id }], ['id'])
  await updateRows('guest_invite_preferences', { status: 'claimed', claimed_by: user.id, updated_at: new Date().toISOString() }, [{ column: 'id', operator: 'eq', value: guest.id }], ['id'])
  return invite.room
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


export async function guestJourney(token: string, sessionId: string, response?: Record<string, unknown>) {
  const invite = await getTripRoomInvite(token)
  if (!invite) throw new HttpError(404, 'This invitation is unavailable.')
  const [lookup] = await selectRows<{ id: string }>('trip_room_invites', ['id'], [{ column: 'token_hash', operator: 'eq', value: hash(token) }])
  const [guest] = lookup ? await selectRows<{ session_hash: string }>('guest_invite_preferences', ['session_hash'], [{ column: 'invite_id', operator: 'eq', value: lookup.id }, { column: 'status', operator: 'eq', value: 'submitted' }], { orderBy: 'updated_at', limit: 1 }) : []
  if (!guest || guest.session_hash !== hash(sessionId)) throw new HttpError(403, 'Submit your preferences from this invitation before viewing the group options.')
  const participant = `guest:${lookup.id}`
  if (response) return respondToJourney(invite.room.id, participant, response)
  return getQuestJourney(invite.room.id, participant)
}
