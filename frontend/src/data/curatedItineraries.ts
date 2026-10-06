import { exploreItineraries } from './exploreItineraries'

export type CuratedDay = { day: number; title: string; description: string; highlights: string[]; mood: string }
export type CuratedItinerary = { id: string; title: string; destination: string; country: string; image: string; durationDays: number; budgetBand: 'low' | 'mid' | 'premium'; estimatedCostPerPerson: number; locationType: 'domestic' | 'international'; bestSeasons: string[]; moods: string[]; pace: 'slow' | 'balanced' | 'fast'; accommodationTypes: string[]; ageFriendlyGroups: string[]; mustHaveTags: string[]; avoidTags: string[]; shortDescription: string; dayPlan: CuratedDay[] }

const costs: Record<string, number> = { 'Budget-friendly': 650, Moderate: 1450, Premium: 2800 }
const budget = (value: string): CuratedItinerary['budgetBand'] => value === 'Budget-friendly' ? 'low' : value === 'Premium' ? 'premium' : 'mid'
const pace = (moods: string[]): CuratedItinerary['pace'] => moods.includes('Adventure') || moods.includes('Nightlife') ? 'fast' : moods.includes('Relaxation') || moods.includes('Wellness') ? 'slow' : 'balanced'
const tags = (moods: string[]) => [...new Set(moods.flatMap((mood) => mood.toLowerCase().replace('&', 'and').split(/\s+and\s+|\s+/)).filter((tag) => tag.length > 3))]

// Curated source of truth for matching—AI never adds or ranks these itineraries.
export const curatedItineraries: CuratedItinerary[] = exploreItineraries.map((trip) => ({
  id: trip.id, title: trip.title, destination: trip.destination, country: trip.country, image: trip.image, durationDays: Number.parseInt(trip.duration, 10), budgetBand: budget(trip.budget), estimatedCostPerPerson: costs[trip.budget], locationType: trip.country === 'India' ? 'domestic' : 'international', bestSeasons: trip.seasons, moods: trip.moods, pace: pace(trip.moods), accommodationTypes: trip.moods.includes('Adventure') ? ['Hotel', 'Hostel / dormitory'] : ['Hotel', 'Resort', 'Apartment / home rental'], ageFriendlyGroups: ['18–30', '31–50', '51–65'], mustHaveTags: tags(trip.moods), avoidTags: trip.moods.includes('Adventure') ? ['very early mornings'] : [], shortDescription: trip.shortDescription,
  dayPlan: trip.dailyPlan.map((day, index) => ({ day: index + 1, title: day.morning, description: `${day.afternoon}. ${day.evening}.`, highlights: [day.morning, day.afternoon], mood: trip.moods[0] ?? 'Discovery' })),
}))
