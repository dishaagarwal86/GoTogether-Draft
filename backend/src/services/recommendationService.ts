import { supabase } from '../supabase.js'

type Preference = { budget: string | null; days_count: number | null; location_preferences: { scope?: string } | null; mood_preferences: string[] | null; activities_must_have: string | null; activities_preferred: string | null; accommodation_preferences: string[] | null; data: { noGo?: string; pace?: string; ageGroups?: string[] } }
type Catalogue = { id: string; title: string; destination: string; country: string; duration_days: number; budget: string; estimated_cost_usd: number; seasons: string[]; moods: string[]; location_type: string; short_description: string; why_it_fits: string; daily_plan: unknown; ai_context: { pace?: string; highlights?: string[]; avoidIf?: string[] } }
const norm = (value = '') => value.toLowerCase().replace(/&/g, 'and')
const words = (value = '') => norm(value).split(/[^a-z]+/).filter((word) => word.length > 3)
const budgetRank = (value = '') => norm(value).includes('budget') ? 0 : norm(value).includes('premium') ? 2 : 1
const overlap = (needles: string[], haystack: string[]) => needles.filter((item) => haystack.some((value) => norm(value).includes(norm(item)) || norm(item).includes(norm(value)))).length

export async function recommendForQuest(roomId: string) {
  const [preferencesResult, catalogueResult] = await Promise.all([
    supabase.from('preferences').select('budget,days_count,location_preferences,mood_preferences,activities_must_have,activities_preferred,accommodation_preferences,data').eq('trip_room_id', roomId),
    supabase.from('itinerary_catalogue').select('id,title,destination,country,duration_days,budget,estimated_cost_usd,seasons,moods,location_type,short_description,why_it_fits,daily_plan,ai_context'),
  ])
  if (preferencesResult.error) throw new Error(preferencesResult.error.message); if (catalogueResult.error) throw new Error(catalogueResult.error.message)
  const preferences = (preferencesResult.data ?? []) as Preference[]; const catalogue = (catalogueResult.data ?? []) as Catalogue[]
  if (!preferences.length) return { travelDna: null, results: [] }
  const budgets = preferences.map((item) => budgetRank(item.budget ?? 'Moderate')); const budgetCeiling = Math.min(...budgets)
  const noGos = preferences.flatMap((item) => words(item.data?.noGo ?? '')); const moods = preferences.flatMap((item) => item.mood_preferences ?? []); const needs = preferences.flatMap((item) => words(`${item.activities_must_have ?? ''} ${item.activities_preferred ?? ''}`)); const paces = preferences.map((item) => item.data?.pace ?? '').filter(Boolean)
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
  const picks = [scored[0], scored[1] ?? scored[0], scored.find((item) => item.id !== scored[0]?.id && item.id !== scored[1]?.id) ?? scored[2]].filter(Boolean)
  return { travelDna: { sharedVibe: [...new Set(moods)].slice(0, 3), budgetStyle: ['Budget-friendly', 'Moderate', 'Premium'][budgetCeiling], noGoActivities: noGos }, results: picks.map((item, index) => ({ ...item, label: ['Best shared match', 'Fair compromise', 'Unexpected match'][index] })) }
}
