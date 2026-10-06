import { selectRows } from '../storage.js'

type Preference = { user_id: string; budget: string | null; days_count: number | null; location_preferences: { scope?: string } | null; mood_preferences: string[] | null; activities_must_have: string | null; activities_preferred: string | null; accommodation_preferences: string[] | null; data: { noGo?: string; pace?: string; ageGroups?: string[] } }
type Catalogue = { id: string; title: string; destination: string; country: string; duration_days: number; budget: string; estimated_cost_usd: number; seasons: string[]; moods: string[]; location_type: string; short_description: string; why_it_fits: string; daily_plan: unknown; ai_context: { pace?: string; highlights?: string[]; avoidIf?: string[] } }
type Room = { members: number }
type AcceptedQuestNote = { type: 'activity' | 'mood' | 'budget' | 'accommodation' | 'no_go'; suggestion: string }
export type QuestReadinessOption = { id: 'comfort' | 'experiences'; title: string; summary: string; detail: string; outcome: string }
export type QuestReadiness = {
  totalMembers: number
  completedMembers: number
  readinessState: 'gathering' | 'deciding' | 'unlocked'
  mainTension: string | null
  recommendedAction: string
  options: QuestReadinessOption[]
  selectedOption: string | null
  explanation: string
}
const norm = (value = '') => value.toLowerCase().replace(/&/g, 'and')
const words = (value = '') => norm(value).split(/[^a-z]+/).filter((word) => word.length > 3)
const budgetRank = (value = '') => norm(value).includes('budget') ? 0 : norm(value).includes('premium') ? 2 : 1
const overlap = (needles: string[], haystack: string[]) => needles.filter((item) => haystack.some((value) => norm(value).includes(norm(item)) || norm(item).includes(norm(value)))).length

function optionCost(rank: number, comfort: boolean) {
  const base = [10000, 14000, 21000][rank] ?? 14000
  return base + (comfort ? 4000 : 0)
}
function rupees(value: number) { return `₹${new Intl.NumberFormat('en-IN').format(value)}` }

function buildQuestReadiness(preferences: Preference[], totalMembers: number): QuestReadiness {
  const completedMembers = new Set(preferences.map((item) => item.user_id)).size
  const budgets = preferences.map((item) => budgetRank(item.budget ?? 'Moderate'))
  const accommodation = preferences.flatMap((item) => item.accommodation_preferences ?? []).map(norm)
  const hasComfortStay = accommodation.some((item) => item.includes('hotel') || item.includes('resort') || item.includes('villa'))
  const hasValueStay = accommodation.some((item) => item.includes('apartment') || item.includes('hostel') || item.includes('open'))
  const budgetConflict = new Set(budgets).size > 1
  const comfortConflict = hasComfortStay && hasValueStay
  const hasTradeOff = preferences.length > 1 && (budgetConflict || comfortConflict)
  const nearComplete = completedMembers >= Math.max(1, totalMembers - 1)
  const lowestBudget = budgets.length ? Math.min(...budgets) : 1
  const comfortCost = optionCost(lowestBudget, true)
  const experienceCost = optionCost(lowestBudget, false)
  const mustHaveCount = preferences.filter((item) => Boolean(item.activities_must_have?.trim())).length
  const withinComfort = preferences.filter((item) => budgetRank(item.budget ?? 'Moderate') >= lowestBudget + (budgetConflict ? 1 : 0)).length
  const withinExperience = preferences.filter((item) => budgetRank(item.budget ?? 'Moderate') >= lowestBudget).length
  const options: QuestReadinessOption[] = hasTradeOff ? [
    {
      id: 'comfort', title: 'Comfort first', summary: `Boutique hotel · ${rupees(comfortCost)} per person`,
      detail: 'Keep the stay quality, simplify one paid activity.',
      outcome: `This option respects ${Math.max(1, mustHaveCount)} must-have${mustHaveCount === 1 ? '' : 's'} and stays within the preferred budget for ${Math.max(1, withinComfort)} traveller${withinComfort === 1 ? '' : 's'}.`,
    },
    {
      id: 'experiences', title: 'Experience first', summary: `Apartment stay · ${rupees(experienceCost)} per person`,
      detail: 'Keep the food tour, cooking class, and day excursion.',
      outcome: `This option respects ${Math.max(1, mustHaveCount)} must-have${mustHaveCount === 1 ? '' : 's'} and stays within the preferred budget for ${Math.max(1, withinExperience)} traveller${withinExperience === 1 ? '' : 's'}.`,
    },
  ] : []
  if (completedMembers < totalMembers && !nearComplete) return {
    totalMembers, completedMembers, readinessState: 'gathering', mainTension: null,
    recommendedAction: 'Invite the remaining travellers to share what matters to them.', options, selectedOption: null,
    explanation: `${completedMembers} of ${totalMembers} voices are in. Your group needs a little more of the story before making a shared call.`,
  }
  if (!hasTradeOff && completedMembers >= totalMembers) return {
    totalMembers, completedMembers, readinessState: 'unlocked', mainTension: null,
    recommendedAction: 'Explore your curated journeys.', options: [], selectedOption: null,
    explanation: 'Your crew is aligned on budget and stay style. The path ahead is clear.',
  }
  return {
    totalMembers, completedMembers, readinessState: 'deciding',
    mainTension: hasTradeOff ? 'One choice is still holding this quest back: stay comfort versus experience budget.' : null,
    recommendedAction: hasTradeOff ? 'Choose your group’s trade-off' : 'Wait for the remaining voices, then choose a direction together.',
    options, selectedOption: null,
    explanation: completedMembers < totalMembers ? `${completedMembers} of ${totalMembers} travellers are aligned. One more voice can still shape the final call.` : 'Every traveller has shared their preferences. Choose the trade-off your group feels good about.',
  }
}

export async function recommendForQuest(roomId: string) {
  const [preferences, catalogue, rooms, acceptedNotes] = await Promise.all([
    selectRows<Preference>('preferences', ['user_id', 'budget', 'days_count', 'location_preferences', 'mood_preferences', 'activities_must_have', 'activities_preferred', 'accommodation_preferences', 'data'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }]),
    selectRows<Catalogue>('itinerary_catalogue', ['id', 'title', 'destination', 'country', 'duration_days', 'budget', 'estimated_cost_usd', 'seasons', 'moods', 'location_type', 'short_description', 'why_it_fits', 'daily_plan', 'ai_context']),
    selectRows<Room>('trip_rooms', ['members'], [{ column: 'id', operator: 'eq', value: roomId }]),
    selectRows<AcceptedQuestNote>('quest_notes', ['type', 'suggestion'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'status', operator: 'eq', value: 'accepted' }]),
  ])
  const totalMembers = Math.max(1, Number(rooms[0]?.members) || preferences.length || 1)
  const questReadiness = buildQuestReadiness(preferences, totalMembers)
  if (!preferences.length) return { travelDna: null, memberCount: 0, totalMembers, questReadiness, results: [] }
  const budgets = preferences.map((item) => budgetRank(item.budget ?? 'Moderate')); const budgetCeiling = Math.min(...budgets)
  const noteWords = (type: AcceptedQuestNote['type']) => acceptedNotes.filter((note) => note.type === type).flatMap((note) => words(note.suggestion))
  const noGos = [...preferences.flatMap((item) => words(item.data?.noGo ?? '')), ...noteWords('no_go')]; const moods = [...preferences.flatMap((item) => item.mood_preferences ?? []), ...noteWords('mood')]; const needs = [...preferences.flatMap((item) => words(`${item.activities_must_have ?? ''} ${item.activities_preferred ?? ''}`)), ...noteWords('activity')]; const paces = preferences.map((item) => item.data?.pace ?? '').filter(Boolean)
  const filtered = catalogue.filter((trip) => budgetRank(trip.budget) <= budgetCeiling && !noGos.some((avoid) => (trip.ai_context?.avoidIf ?? []).some((tag) => norm(avoid).includes(norm(tag)))) && preferences.every((item) => !item.days_count || Math.abs(trip.duration_days - item.days_count) <= 2))
  const pool = filtered.length >= 3 ? filtered : catalogue.filter((trip) => budgetRank(trip.budget) <= budgetCeiling)
  const scored = pool.map((trip) => {
    const mood = overlap(moods, trip.moods) / Math.max(1, moods.length)
    const activity = overlap(needs, [...trip.moods, ...(trip.ai_context?.highlights ?? [])]) / Math.max(1, preferences.length)
    const budget = budgetRank(trip.budget) <= budgetCeiling ? 1 : 0
    const pace = paces.length ? paces.filter((item) => norm(item) === norm(trip.ai_context?.pace ?? '')).length / paces.length : .7
    const fairness = preferences.map((item) => overlap(item.mood_preferences ?? [], trip.moods) + overlap(words(item.activities_must_have ?? ''), trip.ai_context?.highlights ?? []))
    const penalty = Math.min(...fairness) === 0 ? .2 : 0
    const moodMatches = trip.moods.filter((value) => moods.some((memberMood) => norm(value).includes(norm(memberMood))))
    const highlightMatches = (trip.ai_context?.highlights ?? []).filter((value) => needs.some((need) => norm(value).includes(need)))
    const matchedPreferences = [...new Set([...moodMatches, ...highlightMatches])]
    return { ...trip, score: Math.round((mood * .35 + activity * .25 + budget * .2 + pace * .1 + .1 - penalty) * 100), matchedPreferences, compromises: penalty ? ['Some individual interests remain optional on this route.'] : ['No stated non-negotiable is broken.'] }
  }).sort((a, b) => b.score - a.score)
  const picks = scored.slice(0, 3)
  return { memberCount: new Set(preferences.map((item) => item.user_id)).size, totalMembers, questReadiness, travelDna: { sharedVibe: [...new Set(moods)].slice(0, 3), budgetStyle: ['Budget-friendly', 'Moderate', 'Premium'][budgetCeiling], noGoActivities: noGos }, results: picks.map((item, index) => ({ ...item, label: ['Best shared match', 'Fair compromise', 'Unexpected match'][index] })) }
}
