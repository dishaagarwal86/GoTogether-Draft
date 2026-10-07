import { selectRows } from '../storage.js'
import { HttpError } from './access.js'
import type { Preference } from './recommendationService.js'

export const preferenceColumns = ['user_id', 'budget', 'dates', 'days_count', 'location_preferences', 'mood_preferences', 'activities_must_have', 'activities_preferred', 'accommodation_preferences', 'data']
export type Participant = { id: string; name: string; role: string; status: 'invited' | 'expired' | 'joined' | 'ready'; inviteId?: string; preference?: Preference }

export function preferenceFromAnswers(id: string, data: Record<string, unknown>): Preference {
  return { user_id: id, budget: data.budget as string ?? null, dates: data.dates as Preference['dates'], days_count: Number(data.daysCount) || null, location_preferences: data.locationPreferences as Preference['location_preferences'] ?? null, mood_preferences: data.moodPreferences as string[] ?? [], accommodation_preferences: data.accommodationPreferences as string[] ?? [], activities_must_have: data.activitiesMustHave as string ?? '', activities_preferred: data.activitiesPreferred as string ?? '', data }
}

export function preferencesComplete(preference?: Preference) {
  if (!preference || preference.data?.submitted === false) return false
  const dates = preference.dates
  return ['Flexible', 'Budget-friendly', 'Moderate', 'Premium'].includes(preference.budget ?? '')
    && Number.isInteger(preference.days_count) && Number(preference.days_count) >= 1 && Number(preference.days_count) <= 30
    && Boolean(preference.mood_preferences?.length) && Boolean(preference.data?.pace)
    && Boolean(dates?.flexible || (dates?.start && dates?.end && dates.start <= dates.end))
}

export async function questParticipants(roomId: string) {
  const [rooms, members, rows, invites] = await Promise.all([
    selectRows<{ id: string; name: string; trip_name: string; members: number }>('trip_rooms', ['id', 'name', 'trip_name', 'members'], [{ column: 'id', operator: 'eq', value: roomId }]),
    selectRows<{ user_id: string; role: string }>('trip_room_people', ['user_id', 'role'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'invite_status', operator: 'eq', value: 'accepted' }]),
    selectRows<Preference>('preferences', preferenceColumns, [{ column: 'trip_room_id', operator: 'eq', value: roomId }], { orderBy: 'updated_at' }),
    selectRows<{ id: string; email: string; expires_at: string }>('trip_room_invites', ['id', 'email', 'expires_at'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'status', operator: 'eq', value: 'pending' }]),
  ])
  const room = rooms[0]
  if (!room) throw new HttpError(404, 'This quest is unavailable.')
  const [users, guests] = await Promise.all([
    members.length ? selectRows<{ id: string; first_name: string; last_name: string; email: string }>('users', ['id', 'first_name', 'last_name', 'email'], [{ column: 'id', operator: 'in', value: members.map(member => member.user_id) }]) : [],
    invites.length ? selectRows<{ invite_id: string; data: Record<string, unknown> }>('guest_invite_preferences', ['invite_id', 'data'], [{ column: 'invite_id', operator: 'in', value: invites.map(invite => invite.id) }, { column: 'status', operator: 'eq', value: 'submitted' }], { orderBy: 'updated_at' }) : [],
  ])
  const participants: Participant[] = members.map(member => {
    const person = users.find(user => user.id === member.user_id)
    const preference = rows.find(row => row.user_id === member.user_id)
    return { id: member.user_id, name: [person?.first_name, person?.last_name].filter(Boolean).join(' ') || 'A traveller', role: member.role, status: preferencesComplete(preference) ? 'ready' : 'joined', preference }
  })
  for (const invite of invites) {
    if (users.some(user => user.email.toLowerCase() === invite.email.toLowerCase())) continue
    const expired = new Date(invite.expires_at).getTime() <= Date.now()
    const guest = guests.find(item => item.invite_id === invite.id)
    const id = `guest:${invite.id}`
    const preference = !expired && guest ? preferenceFromAnswers(id, guest.data) : undefined
    participants.push({ id, name: String(guest?.data.displayName || 'Invited traveller').slice(0, 80), role: 'guest', inviteId: invite.id, status: expired ? 'expired' : preferencesComplete(preference) ? 'ready' : 'invited', preference })
  }
  const totalMembers = Math.max(1, Number(room.members) || 1, participants.length)
  const completedMembers = participants.filter(person => person.status === 'ready').length
  return { room, participants, totalMembers, completedMembers, ready: completedMembers === totalMembers, preferences: participants.filter(person => person.status === 'ready').map(person => person.preference!) }
}

export function sharedAvailability(preferences: Preference[]) {
  const fixed = preferences.map(item => item.dates).filter(dates => dates && !dates.flexible && dates.start && dates.end)
  if (!fixed.length) return { start: null, end: null, days: null, conflict: false }
  const start = fixed.map(dates => dates!.start!).sort().at(-1)!
  const end = fixed.map(dates => dates!.end!).sort()[0]
  const days = Math.floor((Date.parse(end) - Date.parse(start)) / 86400000) + 1
  return { start, end, days, conflict: !Number.isFinite(days) || days < 1 }
}
