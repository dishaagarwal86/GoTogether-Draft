import type { AnswerValue } from '../data/Questions'
import { apiUrl } from '../services/apiUrl'

const currentUserKey = 'gotogether.current-user-id'

type ApiResponse<T> = { data: T; error?: string }
type User = { id: string }
type TripRoom = { id: string }

async function request<T>(path: string, options?: RequestInit) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(apiUrl(path), {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
    const body = await response.json() as ApiResponse<T>
    if (!response.ok) throw new Error(body.error || 'We could not save your Travel DNA. Please try again.')
    return body.data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Saving took too long. Check that the GoTogether API is running, then try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

async function currentUser() {
  const savedUserId = window.localStorage.getItem(currentUserKey)
  if (savedUserId) return savedUserId

  const suffix = crypto.randomUUID()
  const user = await request<User>('/users', {
    method: 'POST',
    body: JSON.stringify({ name: 'GoTogether traveller', email: `traveller-${suffix}@local.gotogether` }),
  })
  window.localStorage.setItem(currentUserKey, user.id)
  return user.id
}

export async function saveTravelDna(travelDnaName: string, answers: Record<string, AnswerValue>, inviteEmail?: string) {
  const userId = await currentUser()
  const room = await request<TripRoom>('/trip-rooms', {
    method: 'POST',
    body: JSON.stringify({
      name: travelDnaName,
      tripName: typeof answers.destination === 'string' && answers.destination.trim() ? answers.destination.trim() : travelDnaName,
      members: Number(answers.groupSize) || 1,
      inviteEmail,
      ownerId: userId,
    }),
  })

  const preferences = await request<{ id: string }>(`/users/${userId}/preferences`, {
    method: 'POST',
    body: JSON.stringify({
      tripRoomId: room.id,
      dates: { start: answers.startDate ?? null, end: answers.endDate ?? null, flexible: answers.flexibleDates === 'yes' },
      budget: answers.budget ?? null,
      peopleCount: Number(answers.groupSize) || null,
      daysCount: tripLengthToDays(answers.tripLength),
      kidsInvolved: Array.isArray(answers.ageGroups) && answers.ageGroups.some((age) => age === 'Under 12' || age === '13–17'),
      locationPreferences: { scope: answers.destinationScope ?? null, destination: answers.destination ?? null },
      moodPreferences: answers.tripFeeling ?? [],
      activitiesMustHave: answers.mustHave ?? '',
      activitiesPreferred: answers.niceToHave ?? '',
      accommodationPreferences: answers.stayStyle ?? [],
      noGo: answers.noGo ?? '',
      pace: answers.pace ?? null,
      discovery: answers.discovery ?? null,
      priorities: answers.priorities ?? [],
      companions: answers.companions ?? null,
      ageGroups: answers.ageGroups ?? [],
    }),
  })

  return { userId, roomId: room.id, preferenceId: preferences.id }
}

function tripLengthToDays(value: AnswerValue | undefined) {
  if (value === 'Weekend') return 2
  if (value === '3–4 days') return 4
  if (value === '5–7 days') return 6
  if (value === 'More than a week') return 8
  return null
}
