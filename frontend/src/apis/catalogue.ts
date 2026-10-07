import { apiUrl } from '../services/apiUrl'
import type { ExploreItinerary } from '../data/exploreItineraries'

const IMAGES: Record<string, string> = {
  'Santorini': 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=85',
  'Bali': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=85',
  'Amalfi Coast': 'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=1200&q=85',
  'Kyoto': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=85',
  'Interlaken': 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85',
  'Marrakech': 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=85',
  'Barcelona': 'https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1200&q=85',
  'Cappadocia': 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=85',
  'Kerala': 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=85',
  'Reykjavík': 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?auto=format&fit=crop&w=1200&q=85',
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=85'

type CatalogueRow = {
  id: string; title: string; destination: string; country: string
  duration_days: number; budget: 'Budget-friendly' | 'Moderate' | 'Premium'
  seasons: string[]; moods: string[]; location_type: string
  short_description: string; why_it_fits: string
  daily_plan: { day: number; morning: string; afternoon: string; evening: string }[]
}

function mapRow(row: CatalogueRow): ExploreItinerary {
  return {
    id: row.id,
    title: row.title,
    destination: row.destination,
    country: row.country,
    image: IMAGES[row.destination] ?? FALLBACK_IMAGE,
    duration: `${row.duration_days} days`,
    budget: row.budget,
    seasons: row.seasons,
    moods: row.moods,
    locationType: row.location_type,
    matchScore: 0,
    shortDescription: row.short_description,
    whyItFits: row.why_it_fits,
    dailyPlan: row.daily_plan.map((d) => ({ day: `Day ${d.day}`, morning: d.morning, afternoon: d.afternoon, evening: d.evening })),
  }
}

export async function fetchCatalogue(): Promise<ExploreItinerary[]> {
  const response = await fetch(apiUrl('/itineraries/catalogue'))
  if (!response.ok) throw new Error('Failed to load itineraries')
  const { data } = await response.json() as { data: CatalogueRow[] }
  return data.map(mapRow)
}

export async function fetchUserPreferences(userId: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(apiUrl(`/users/${encodeURIComponent(userId)}/preferences`), { headers: { Authorization: `Bearer ${localStorage.getItem('gotogether.session-token') ?? ''}` } })
  if (!response.ok) return null
  const { data } = await response.json() as { data: Record<string, unknown>[] }
  return data.length > 0 ? data[0] : null
}

type QuestResult = { id: string; title: string; destination: string; country: string; duration_days: number; budget: string; seasons: string[]; moods: string[]; location_type: string; short_description: string; why_it_fits: string; daily_plan: { day: number; morning: string; afternoon: string; evening: string }[]; score: number; label: string }
export async function fetchQuestRecommendations(roomId: string): Promise<{ memberCount: number; results: Array<ExploreItinerary & { label: string }> }> {
  const response = await fetch(apiUrl(`/recommendations/quests/${encodeURIComponent(roomId)}`), { headers: { Authorization: `Bearer ${localStorage.getItem('gotogether.session-token') ?? ''}` } })
  if (!response.ok) throw new Error('Could not load recommendations')
  const { data } = await response.json() as { data: { memberCount: number; results: QuestResult[] } }
  return { memberCount: data.memberCount, results: data.results.map((item) => ({ id: item.id, title: item.title, destination: item.destination, country: item.country, image: IMAGES[item.destination] ?? FALLBACK_IMAGE, duration: `${item.duration_days} days`, budget: item.budget as 'Budget-friendly' | 'Moderate' | 'Premium', seasons: item.seasons, moods: item.moods, locationType: item.location_type, matchScore: item.score, shortDescription: item.short_description, whyItFits: item.why_it_fits, dailyPlan: item.daily_plan.map((d) => ({ day: `Day ${d.day}`, morning: d.morning, afternoon: d.afternoon, evening: d.evening })), label: item.label })) }
}
export async function generateItineraries(preferences: Record<string, unknown>, roomId?: string): Promise<ExploreItinerary[]> {
  const response = await fetch(apiUrl('/itineraries/ai-generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('gotogether.session-token') ?? ''}` },
    body: JSON.stringify({ preferences, roomId }),
  })
  if (!response.ok) throw new Error('Could not generate itineraries')
  const { data } = await response.json() as { data: ExploreItinerary[] }
  return data.map((item) => ({
    ...item,
    id: (item as Record<string, unknown>).id as string ?? `ai_${crypto.randomUUID()}`,
    image: IMAGES[item.destination] ?? FALLBACK_IMAGE,
    matchScore: 92,
  }))
}
