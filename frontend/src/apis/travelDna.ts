import type { AnswerValue } from '../data/Questions'
import { apiUrl } from '../services/apiUrl'

type Preference = Record<string, unknown> & { id: string; tripRoomId: string }
async function request<T>(path: string, options?: RequestInit) {
  const response = await fetch(apiUrl(path), { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('gotogether.session-token') ?? ''}`, ...options?.headers }, signal: AbortSignal.timeout(20000) })
  const body = await response.json().catch(() => null) as { data?: T; error?: string } | null
  if (!response.ok) throw new Error(body?.error || 'We couldn’t save your preferences. Please try again.')
  return body?.data as T
}
export async function getRoomPreference(userId: string, roomId: string) {
  return (await request<Preference[]>(`/users/${userId}/preferences`)).find((item) => item.tripRoomId === roomId)
}
export function preferenceAnswers(preference: Preference): Record<string, AnswerValue> {
  const dates = preference.dates as { start?: string; end?: string; flexible?: boolean } | undefined
  const location = preference.locationPreferences as { scope?: string; destination?: string; fixed?: boolean } | undefined
  const days = Number(preference.daysCount)
  return { dayStart: String(preference.dayStart ?? ''), personalizationEnabled: preference.personalizationEnabled === false ? 'no' : 'yes', startDate: dates?.start ?? '', endDate: dates?.end ?? '', flexibleDates: dates?.flexible ? 'yes' : '', tripLength: days === 2 ? 'Weekend' : days === 4 ? '3–4 days' : days === 6 ? '5–7 days' : days === 8 ? 'More than a week' : days ? `${days} days` : '', groupSize: String(preference.peopleCount || 1), destinationScope: location?.scope ?? '', destinationFixed: location?.fixed ? 'yes' : '', destination: location?.destination ?? '', budget: String(preference.budget ?? ''), tripFeeling: (preference.moodPreferences as string[] ?? []).map(mood => mood === 'Food & Culture' ? 'Food & local culture' : mood), stayStyle: preference.accommodationPreferences as string[] ?? [], mustHave: String(preference.activitiesMustHave ?? ''), niceToHave: String(preference.activitiesPreferred ?? ''), noGo: String(preference.noGo ?? ''), pace: String(preference.pace ?? ''), discovery: String(preference.discovery ?? ''), companions: String(preference.companions ?? ''), ageGroups: preference.ageGroups as string[] ?? [], priorities: preference.priorities as string[] ?? [] }
}
export async function saveTravelDna(name: string, answers: Record<string, AnswerValue>, inviteEmail?: string, options?: { roomId?: string; onRoomCreated?: (roomId: string) => void }) {
  const userId = localStorage.getItem('gotogether.current-user-id')
  if (!userId) throw new Error('Please sign in to save your quest.')
  let roomId = options?.roomId
  let invitation: { delivered: boolean; reason?: string } | undefined
  if (!roomId) {
    const room = await request<{ id: string; invite?: { delivered: boolean; reason?: string } }>('/trip-rooms', { method: 'POST', body: JSON.stringify({ name, tripName: typeof answers.destination === 'string' && answers.destination.trim() ? answers.destination.trim() : name, members: Number(answers.groupSize) || 1, inviteEmail, ownerId: userId }) })
    roomId = room.id; invitation = room.invite; options?.onRoomCreated?.(roomId)
  }
  const existing = await getRoomPreference(userId, roomId)
  const payload = { dayStart: answers.dayStart ?? '', personalizationEnabled: answers.personalizationEnabled !== 'no', tripRoomId: roomId, dates: { start: answers.flexibleDates === 'yes' ? null : answers.startDate ?? null, end: answers.flexibleDates === 'yes' ? null : answers.endDate ?? null, flexible: answers.flexibleDates === 'yes' }, budget: answers.budget ?? null, peopleCount: Number(answers.groupSize) || null, daysCount: answers.tripLength === 'Weekend' ? 2 : answers.tripLength === '3–4 days' ? 4 : answers.tripLength === '5–7 days' ? 6 : Number.parseInt(String(answers.tripLength), 10) || 8, kidsInvolved: Array.isArray(answers.ageGroups) && answers.ageGroups.some((age) => age === 'Under 12' || age === '13–17'), locationPreferences: { scope: answers.destinationScope ?? null, destination: answers.destination ?? null, fixed: answers.destinationFixed === 'yes' }, moodPreferences: answers.tripFeeling ?? [], activitiesMustHave: answers.mustHave ?? '', activitiesPreferred: answers.niceToHave ?? '', accommodationPreferences: answers.stayStyle ?? [], noGo: answers.noGo ?? '', pace: answers.pace ?? null, discovery: answers.discovery ?? null, priorities: answers.priorities ?? [], companions: answers.companions ?? null, ageGroups: answers.ageGroups ?? [] }
  const preference = await request<{ id: string }>(`/users/${userId}/preferences${existing ? `/${existing.id}` : ''}`, { method: existing ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
  return { userId, roomId, preferenceId: preference.id, invitation }
}
