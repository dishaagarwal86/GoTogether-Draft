import { exploreItineraries, type ExploreItinerary } from '../data/exploreItineraries'
import { demoTravellers, type TravellerProfile } from '../data/groupMockData'

export type ScoredItinerary = ExploreItinerary & { groupFit: number; fairness: number; finalScore: number }
export type PlanPath = { id: string; title: string; label: string; description: string; itinerary: ScoredItinerary; tradeoff: string }

const normalise = (value: string) => value.toLowerCase().replace('food & culture', 'food').replace('food and local culture', 'food')
const travellerScore = (trip: ExploreItinerary, person: TravellerProfile) => {
  const matches = person.moods.filter((mood) => {
    return trip.moods.some((tripMood) => normalise(tripMood).includes(normalise(mood)) || normalise(mood).includes(normalise(tripMood)))
  }).length
  const moodScore = (matches / person.moods.length) * 72
  const budgetScore = person.budget === trip.budget ? 20 : person.budget === 'Premium' || trip.budget === 'Moderate' ? 13 : 7
  return Math.min(100, Math.round(moodScore + budgetScore + (trip.locationType === 'Beach' && person.moods.includes('Relaxation') ? 8 : 0)))
}

export const getScoredItineraries = (travellers = demoTravellers): ScoredItinerary[] => exploreItineraries.map((itinerary) => {
  const scores = travellers.map((person) => travellerScore(itinerary, person))
  const groupFit = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
  const fairness = Math.min(...scores)
  return { ...itinerary, groupFit, fairness, finalScore: Math.round(groupFit * .65 + fairness * .35) }
}).sort((a, b) => b.finalScore - a.finalScore)

export const getPlanPaths = (): PlanPath[] => {
  const ranked = getScoredItineraries()
  const best = ranked[0]
  const fair = [...ranked].sort((a, b) => b.fairness - a.fairness)[0]
  const unexpected = ranked.find((trip) => trip.id !== best.id && trip.locationType === 'Hidden gems') ?? ranked[2]
  return [
    { id: 'best-shared', title: 'Best Shared Fit', label: `${best.finalScore}% group fit`, itinerary: best, description: 'The strongest overlap across your group’s mood, rhythm and budget.', tradeoff: 'Leans toward the interests you share most.' },
    { id: 'fair-compromise', title: 'Fair Compromise', label: `${fair.fairness}% minimum individual fit`, itinerary: fair, description: 'The most balanced option—no traveller is left with a weak match.', tradeoff: 'May be less intense for the group’s biggest enthusiasts.' },
    { id: 'unexpected', title: 'Unexpected Discovery', label: `${unexpected.finalScore}% group fit`, itinerary: unexpected, description: 'A slightly bolder choice that still honours the group’s core preferences.', tradeoff: 'A little more novelty, a little less certainty.' },
  ]
}
