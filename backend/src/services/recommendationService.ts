import { selectRows } from '../storage.js'
import { budgetRank, moodName, normalize, violatesNoGo } from './travelPreferences.js'
import { contextFor, effectiveMemories, getTravelProfile } from './travelMemory.js'
import { contextKey } from './aiHistory.js'
import { aiQuestItineraries } from './aiItineraryService.js'

export type Preference = { user_id?: string; budget: string | null; days_count: number | null; people_count?: number | null; dates?: { start?: string | null; end?: string | null; flexible?: boolean } | null; location_preferences: { scope?: string; destination?: string; departureCity?: string; fixed?: boolean } | null; mood_preferences: string[] | null; activities_must_have: string | null; activities_preferred: string | null; accommodation_preferences: string[] | null; data: { noGo?: string; pace?: string; ageGroups?: string[]; companions?: string; dayStart?: string; personalizationEnabled?: boolean } }
export type Catalogue = { id: string; title: string; destination: string; country: string; duration_days: number; budget: string; estimated_cost_usd: number; seasons: string[]; moods: string[]; location_type: string; short_description: string; why_it_fits: string; daily_plan: unknown; ai_context: { pace?: string; highlights?: string[]; avoidIf?: string[]; activityTags?: string[]; primaryMood?: string } }
const words = (value = '') => normalize(value).split(' ').filter(word => word.length > 3 && !['with', 'have', 'want', 'would', 'like', 'some'].includes(word))
const fraction = (desired: string[], available: string[]) => desired.length ? desired.filter(item => available.some(value => normalize(value).includes(normalize(item)))).length / desired.length : .7
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length


export function rankRecommendations(preferences: Preference[], catalogue: Catalogue[]) {
  if (!preferences.length) return { travelDna: null, memberCount: 0, results: [], blockers: ['Save your travel preferences to see matching itineraries.'] }
  const budgetCeiling = Math.min(...preferences.map(item => budgetRank(item.budget ?? 'Moderate')))
  const noGos = preferences.map(item => item.data?.noGo ?? '').filter(Boolean)
  const sharedMoods = preferences.flatMap(item => (item.mood_preferences ?? []).map(moodName))
  const fixedPlaces = preferences.filter(item => item.location_preferences?.fixed).map(item => normalize(item.location_preferences?.destination ?? '')).filter(Boolean)
  const pool = catalogue.filter(trip => {
    const activities = JSON.stringify([trip.daily_plan, trip.ai_context?.highlights, trip.ai_context?.avoidIf, trip.ai_context?.activityTags, trip.moods])
    return budgetRank(trip.budget) <= budgetCeiling
      && fixedPlaces.every(place => [trip.destination, trip.country].some(value => normalize(value) === place))
      && preferences.every(item => !item.days_count || Math.abs(trip.duration_days - item.days_count) <= 2)
      && !noGos.some(noGo => violatesNoGo(noGo, activities))
  })
  const scored = pool.map(trip => {
    const highlights = trip.ai_context?.highlights ?? []
    const fits = preferences.map(item => {
      const mood = fraction((item.mood_preferences ?? []).map(moodName), trip.moods.map(moodName))
      const activity = fraction(words((item.activities_must_have ?? '') + ' ' + (item.activities_preferred ?? '')), [...highlights, ...trip.moods])
      const pace = !item.data?.pace || normalize(item.data.pace) === normalize(trip.ai_context?.pace ?? '') ? 1 : .4
      const destination = item.location_preferences?.destination
      const location = !destination || normalize(trip.destination + ' ' + trip.country).includes(normalize(destination)) ? 1 : .4
      return Math.round((mood * .35 + activity * .25 + .2 + pace * .1 + location * .1) * 100)
    })
    const minFit = Math.min(...fits)
    const score = Math.max(0, Math.min(100, Math.round(mean(fits) - (minFit < 30 ? 10 : 0))))
    const matchedPreferences = [...new Set(trip.moods.filter(value => sharedMoods.includes(moodName(value))).concat(highlights.filter(value => preferences.some(item => words(item.activities_must_have ?? '').some(word => normalize(value).includes(word))))))]
    return { ...trip, score, minFit, matchedPreferences, compromises: minFit < 50 ? ['Some travellers have fewer interests represented. Discuss optional activities together.'] : ["Fits the saved budget and trip length. Confirm the activities respect everyone's boundaries."] }
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  const best = scored[0]
  const fair = scored.filter(trip => trip.id !== best?.id).sort((a, b) => b.minFit - a.minFit || b.score - a.score || a.id.localeCompare(b.id))[0]
  const novelty = (trip: typeof best) => (trip.destination !== best?.destination ? 25 : 0) + trip.moods.filter(mood => !best?.moods.includes(mood)).length * 10 + trip.score * .3
  const unexpected = scored.filter(trip => trip.id !== best?.id && trip.id !== fair?.id).sort((a, b) => novelty(b) - novelty(a) || a.id.localeCompare(b.id))[0]
  const picks = [best && { ...best, label: 'Best shared match' }, fair && { ...fair, label: 'Fair compromise' }, unexpected && { ...unexpected, label: preferences.length > 1 ? 'Split plan' : 'Unexpected match' }].filter(item => Boolean(item)) as Array<NonNullable<typeof best> & { label: string }>
  return {
    memberCount: preferences.length,
    travelDna: { sharedVibe: [...new Set(sharedMoods)].slice(0, 3), budgetStyle: ['Budget-friendly', 'Moderate', 'Premium'][budgetCeiling], noGoActivities: noGos, pacePreferences: preferences.map(item => item.data?.pace).filter(Boolean), mustHaveActivities: preferences.map(item => item.activities_must_have).filter(Boolean), departureCities: [...new Set(preferences.map(item => item.location_preferences?.departureCity).filter(Boolean))] as string[], groupSize: Math.max(preferences.length, ...preferences.map(item => item.people_count ?? 0)) },
    results: picks.map(pick => ({ ...pick, location_type: pick.location_type ?? '' })),
    blockers: !picks.length ? ['No starting itinerary fits the selected destination, budget, trip length, and no-go activities. Adjust your preferences to explore other possibilities; your limits have been kept.'] : picks.length < 3 ? ['These are the available starting points within your preferences. Check the duration before choosing.'] : [],
  }
}

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
const norm = normalize

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
    recommendedAction: hasTradeOff ? "Choose your group's trade-off" : 'Wait for the remaining voices, then choose a direction together.',
    options, selectedOption: null,
    explanation: completedMembers < totalMembers ? `${completedMembers} of ${totalMembers} travellers are aligned. One more voice can still shape the final call.` : 'Every traveller has shared their preferences. Choose the trade-off your group feels good about.',
  }
}

export async function recommendForQuest(roomId: string) {
  const [preferences, catalogue, members, rooms, acceptedNotes] = await Promise.all([
    selectRows<Preference>('preferences', ['user_id', 'budget', 'days_count', 'people_count', 'dates', 'location_preferences', 'mood_preferences', 'activities_must_have', 'activities_preferred', 'accommodation_preferences', 'data'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }], { orderBy: 'updated_at' }),
    selectRows<Catalogue>('itinerary_catalogue', ['id', 'title', 'destination', 'country', 'duration_days', 'budget', 'estimated_cost_usd', 'seasons', 'moods', 'location_type', 'short_description', 'why_it_fits', 'daily_plan', 'ai_context']),
    selectRows<{ user_id: string }>('trip_room_people', ['user_id'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'invite_status', operator: 'eq', value: 'accepted' }]),
    selectRows<Room>('trip_rooms', ['members'], [{ column: 'id', operator: 'eq', value: roomId }]),
    selectRows<AcceptedQuestNote>('quest_notes', ['type', 'suggestion'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'status', operator: 'eq', value: 'accepted' }]),
  ])
  const accepted = new Set(members.map(member => member.user_id))
  const latest = new Map<string, Preference>()
  for (const preference of preferences) if (preference.user_id && accepted.has(preference.user_id) && !latest.has(preference.user_id)) latest.set(preference.user_id, preference)
  const savedPreferences = await Promise.all([...latest.values()].map(async preference => {
    if (!preference.user_id || preference.data?.personalizationEnabled === false) return preference
    const memory = effectiveMemories(await getTravelProfile(preference.user_id), contextFor(preference.data?.companions))
    return { ...preference, mood_preferences: preference.mood_preferences?.length ? preference.mood_preferences : memory.interests,
      data: { ...preference.data, pace: preference.data?.pace || memory.pace, noGo: [preference.data?.noGo, ...memory.avoid].filter(Boolean).join('; ') } }
  }))
  const notes = (type: AcceptedQuestNote['type']) => acceptedNotes.filter(note => note.type === type).map(note => note.suggestion)
  const effectivePreferences = savedPreferences.map(preference => ({ ...preference,
    mood_preferences: [...(preference.mood_preferences ?? []), ...notes('mood')],
    activities_preferred: [preference.activities_preferred, ...notes('activity')].filter(Boolean).join(' '),
    data: { ...preference.data, noGo: [preference.data?.noGo, ...notes('no_go')].filter(Boolean).join('; ') },
  }))
  const totalMembers = Math.max(1, Number(rooms[0]?.members) || members.length || 1)
  const preferenceVersion = contextKey([savedPreferences, acceptedNotes])
  const ranked = rankRecommendations(effectivePreferences, catalogue)
  const people = savedPreferences.length ? await selectRows<{ id: string; country: string | null }>('users', ['id', 'country'], [{ column: 'id', operator: 'in', value: savedPreferences.map(item => item.user_id!).filter(Boolean) }]) : []
  const countryOf = new Map(people.map(person => [person.id, person.country]))
  const plannerPreferences = effectivePreferences.map(item => ({ ...item, data: { ...item.data, homeCountry: (item.data as { homeCountry?: string }).homeCountry || countryOf.get(item.user_id ?? '') || undefined } }))
  const aiResults = await aiQuestItineraries(roomId, savedPreferences[0]?.user_id, plannerPreferences, preferenceVersion)
  const plan = aiResults?.length
    ? { ...ranked, results: aiResults as unknown as typeof ranked.results, blockers: [] as string[], source: 'ai' as const }
    : { ...ranked, source: 'catalogue' as const }
  return { ...plan, totalMembers, questReadiness: buildQuestReadiness(savedPreferences, totalMembers), preferenceVersion }
}
