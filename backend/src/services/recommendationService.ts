import { questParticipants, sharedAvailability } from './questParticipants.js'
import { selectRows } from '../storage.js'
import { budgetRank, moodName, normalize, violatesNoGo } from './travelPreferences.js'
import { contextFor, effectiveMemories, getTravelProfile } from './travelMemory.js'
import { aiQuestItineraries, type AiItinerary } from './aiItineraryService.js'
import { contextKey } from './aiHistory.js'

export type Preference = { user_id?: string; dates?: { start?: string | null; end?: string | null; flexible?: boolean }; budget: string | null; days_count: number | null; location_preferences: { scope?: string; destination?: string; departureCity?: string; fixed?: boolean } | null; mood_preferences: string[] | null; activities_must_have: string | null; activities_preferred: string | null; accommodation_preferences: string[] | null; data: { submitted?: boolean; noGo?: string; pace?: string; ageGroups?: string[]; companions?: string; dayStart?: string; personalizationEnabled?: boolean } }
export type Catalogue = Partial<Pick<AiItinerary, 'currency' | 'travel_dates' | 'flights' | 'stays' | 'source' | 'cover_image'>> & { id: string; title: string; destination: string; country: string; duration_days: number; budget: string; estimated_cost_usd: number; seasons: string[]; moods: string[]; location_type: string; short_description: string; why_it_fits: string; daily_plan: unknown; ai_context: { pace?: string; highlights?: string[]; avoidIf?: string[]; activityTags?: string[] } }
const words = (value = '') => normalize(value).split(' ').filter(word => word.length > 3 && !['with', 'have', 'want', 'would', 'like', 'some'].includes(word))
const fraction = (desired: string[], available: string[]) => desired.length ? desired.filter(item => available.some(value => normalize(value).includes(normalize(item)))).length / desired.length : .7
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length


export function rankRecommendations(preferences: Preference[], catalogue: Catalogue[]) {
  if (!preferences.length) return { travelDna: null, memberCount: 0, results: [], allResults: [], blockers: ['Save your travel preferences to see matching itineraries.'] }
  const budgetCeiling = Math.min(...preferences.map(item => budgetRank(item.budget ?? 'Moderate')))
  const noGos = preferences.map(item => item.data?.noGo ?? '').filter(Boolean)
  const sharedMoods = preferences.flatMap(item => (item.mood_preferences ?? []).map(moodName))
  const fixedPlaces = preferences.filter(item => item.location_preferences?.fixed).map(item => normalize(item.location_preferences?.destination ?? '')).filter(Boolean)
  const availability = sharedAvailability(preferences)
  const pool = catalogue.filter(trip => {
    const activities = JSON.stringify([trip.daily_plan, trip.ai_context?.highlights, trip.ai_context?.avoidIf, trip.ai_context?.activityTags, trip.moods])
    return !availability.conflict && (availability.days === null || trip.duration_days <= availability.days) && budgetRank(trip.budget) <= budgetCeiling
      && fixedPlaces.every(place => [trip.destination, trip.country, `${trip.destination}, ${trip.country}`].some(value => normalize(value) === place))
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
    return { ...trip, score, minFit, memberFits: preferences.map((preference, index) => ({ userId: preference.user_id, score: fits[index] })), matchedPreferences, compromises: minFit < 50 ? ['Some travellers have fewer interests represented. Discuss optional activities together.'] : ['Fits the saved budget and trip length. Confirm the activities respect everyone’s boundaries.'] }
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  const best = scored[0]
  const fair = scored.filter(trip => trip.id !== best?.id).sort((a, b) => b.minFit - a.minFit || b.score - a.score || a.id.localeCompare(b.id))[0]
  const novelty = (trip: typeof best) => (trip.destination !== best?.destination ? 25 : 0) + trip.moods.filter(mood => !best?.moods.includes(mood)).length * 10 + trip.score * .3
  const unexpected = scored.filter(trip => trip.id !== best?.id && trip.id !== fair?.id).sort((a, b) => novelty(b) - novelty(a) || a.id.localeCompare(b.id))[0]
  const picks = [best && { ...best, label: 'Best shared match' }, fair && { ...fair, label: 'Fair compromise' }, unexpected && { ...unexpected, label: 'Alternative experience' }].filter(item => Boolean(item)) as Array<NonNullable<typeof best> & { label: string }>
  return {
    memberCount: preferences.length,
    travelDna: { departureCities: [...new Set(preferences.map(item => item.location_preferences?.departureCity).filter((city): city is string => Boolean(city)))], groupSize: preferences.length, sharedVibe: [...new Set(sharedMoods)].slice(0, 3), budgetStyle: ['Budget-friendly', 'Moderate', 'Premium'][budgetCeiling], noGoActivities: noGos, pacePreferences: preferences.map(item => item.data?.pace).filter(Boolean), mustHaveActivities: preferences.map(item => item.activities_must_have).filter(Boolean) },
    results: picks,
    allResults: scored.map(trip => ({ ...trip, label: picks.find(pick => pick.id === trip.id)?.label ?? 'Another matching itinerary' })),
    blockers: !picks.length ? ['No starting itinerary fits the selected destination, budget, trip length, and no-go activities. Adjust your preferences to explore other possibilities; your limits have been kept.'] : picks.length < 3 ? ['These are the available starting points within your preferences. Check the duration before choosing.'] : [],
  }
}

export async function recommendForQuest(roomId: string) {
  const [group, catalogue, acceptedNotes] = await Promise.all([
    questParticipants(roomId),
    selectRows<Catalogue>('itinerary_catalogue', ['id', 'title', 'destination', 'country', 'duration_days', 'budget', 'estimated_cost_usd', 'seasons', 'moods', 'location_type', 'short_description', 'why_it_fits', 'daily_plan', 'ai_context']),
    selectRows<{ type: string; suggestion: string }>('quest_notes', ['type', 'suggestion'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'status', operator: 'eq', value: 'accepted' }]),
  ])
  const savedPreferences = await Promise.all(group.preferences.map(async preference => {
    if (!preference.user_id || preference.user_id.startsWith('guest:') || preference.data?.personalizationEnabled === false) return preference
    const memory = effectiveMemories(await getTravelProfile(preference.user_id), contextFor(preference.data?.companions))
    return { ...preference, mood_preferences: preference.mood_preferences?.length ? preference.mood_preferences : memory.interests,
      data: { ...preference.data, pace: preference.data?.pace || memory.pace, noGo: [preference.data?.noGo, ...memory.avoid].filter(Boolean).join('; ') } }
  }))
  const notes = (type: string) => acceptedNotes.filter(note => note.type === type).map(note => note.suggestion)
  const effectivePreferences = savedPreferences.map(preference => ({ ...preference,
    mood_preferences: [...(preference.mood_preferences ?? []), ...notes('mood')],
    activities_preferred: [preference.activities_preferred, ...notes('activity')].filter(Boolean).join('; '),
    data: { ...preference.data, noGo: [preference.data?.noGo, ...notes('no_go')].filter(Boolean).join('; ') },
  }))
  const availability = sharedAvailability(savedPreferences)
  const preferenceVersion = contextKey([group.totalMembers, group.participants.map(person => [person.id, person.status]), effectivePreferences, acceptedNotes])
  const generated = group.ready && !availability.conflict
    ? await aiQuestItineraries(roomId, group.participants.find(person => person.role === 'owner')?.id, effectivePreferences, preferenceVersion)
    : { results: [], pending: false }
  // Generated options pass the same hard filters and scoring as the catalogue.
  const ranked = rankRecommendations(group.ready ? effectivePreferences : [], [...catalogue, ...generated.results])
  const blockers = !group.ready ? [`${group.completedMembers} of ${group.totalMembers} travellers are ready. Everyone must confirm their preferences before group matches appear.`]
    : availability.conflict ? ['Your travel dates do not overlap. Discuss another date window and update your preferences.'] : ranked.blockers
  return { ...ranked, generationPending: generated.pending, blockers, totalMembers: group.totalMembers, memberCount: group.completedMembers, ready: group.ready,
    participants: group.participants.map(({ preference: _private, ...person }) => person), availability,
    questReadiness: { totalMembers: group.totalMembers, completedMembers: group.completedMembers,
      readinessState: !group.ready ? 'gathering' as const : !ranked.results.length ? 'deciding' as const : 'unlocked' as const,
      mainTension: group.ready && !ranked.results.length ? blockers[0] : null,
      recommendedAction: !group.ready ? 'Bring everyone in and confirm your travel preferences.' : !ranked.results.length ? 'Resolve the shared requirements with your crew.' : 'Compare the itineraries and share your response.',
      options: [], selectedOption: null, explanation: 'Ready preferences unlock suggestions. Agreeing on an itinerary is a separate group decision.' }, preferenceVersion }
}

// Private preference details and other travellers' individual fit scores never
// leave the service. Each caller sees only their own fit alongside group fit.
export function publicRecommendations(result: Awaited<ReturnType<typeof recommendForQuest>>, userId: string) {
  const present = (trip: typeof result.allResults[number]) => { const { memberFits, minFit: _privateMinFit, ...publicTrip } = trip; return { ...publicTrip, label: result.totalMembers === 1 ? ({ 'Best shared match': 'Best for you', 'Fair compromise': 'Another good fit', 'Alternative experience': 'A different direction' } as Record<string, string>)[trip.label] ?? trip.label : trip.label, personalFit: memberFits.find(fit => fit.userId === userId)?.score ?? null } }
  return { ...result, results: result.results.map(present), allResults: result.allResults.map(present), travelDna: result.travelDna ? { ...result.travelDna, noGoActivities: [], mustHaveActivities: [] } : null }
}
