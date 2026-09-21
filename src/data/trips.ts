export type Mood = 'nature' | 'adventure' | 'nightlife'
export type Season = 'summer' | 'autumn' | 'rainy' | 'winter' | 'spring'
export type Location = 'beach' | 'mountains' | 'city' | 'nature' | 'countryside'

export type Itinerary = {
  id: string; place: string; country: string; title: string; detail: string
  dates: string; duration: number; mood: Mood; season: Season; location: Location
  budgetK: number; match: string; image: string
}

const seasons: { season: Season; month: string }[] = [
  { season: 'summer', month: 'July' }, { season: 'autumn', month: 'October' },
  { season: 'rainy', month: 'September' }, { season: 'winter', month: 'January' },
  { season: 'spring', month: 'April' },
]

const destinations: Omit<Itinerary, 'id' | 'dates' | 'duration' | 'season' | 'budgetK' | 'match'>[] = [
  { place: 'Kyoto', country: 'Japan', title: 'Lantern-lit Kyoto', detail: 'Tea houses, hidden lanes, and temple gardens.', mood: 'nature', location: 'city', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=85' },
  { place: 'Lisbon', country: 'Portugal', title: 'Atlantic city glow', detail: 'Trams, tiled lanes, and riverfront nights.', mood: 'nightlife', location: 'city', image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=900&q=85' },
  { place: 'Amalfi Coast', country: 'Italy', title: 'Coastal slow days', detail: 'Cliffside villages, lemon groves, and blue mornings.', mood: 'nature', location: 'beach', image: 'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=900&q=85' },
  { place: 'Queenstown', country: 'New Zealand', title: 'Alpine adrenaline', detail: 'Lake views, high trails, and big mountain energy.', mood: 'adventure', location: 'mountains', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=85' },
  { place: 'Ubud', country: 'Indonesia', title: 'Rainforest reset', detail: 'Rice terraces, waterfalls, and restorative rituals.', mood: 'nature', location: 'nature', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=85' },
  { place: 'Reykjavík', country: 'Iceland', title: 'Northern lights chase', detail: 'Ice caves, hot springs, and midnight skies.', mood: 'adventure', location: 'nature', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=85' },
  { place: 'Marrakech', country: 'Morocco', title: 'Medina after dark', detail: 'Rooftop tea, souks, and late-night music.', mood: 'nightlife', location: 'city', image: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=900&q=85' },
  { place: 'Banff', country: 'Canada', title: 'Turquoise trail days', detail: 'Glacial lakes, sunrise hikes, and campfire dinners.', mood: 'adventure', location: 'mountains', image: 'https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=crop&w=900&q=85' },
  { place: 'Tulum', country: 'Mexico', title: 'Cenotes & beach clubs', detail: 'Clear water swims and warm nights under palms.', mood: 'nightlife', location: 'beach', image: 'https://images.unsplash.com/photo-1512813195386-6cf811ad3542?auto=format&fit=crop&w=900&q=85' },
  { place: 'Cotswolds', country: 'United Kingdom', title: 'Golden village ramble', detail: 'Hedgerows, pubs, and honey-stone cottages.', mood: 'nature', location: 'countryside', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85' },
]

const budgets = [0, 20, 35, 50, 65, 80, 95, 120, 150, 180, 210, 240, 280, 310, 350, 390, 420, 460, 500]

// 10 destinations × 5 seasons = 50 filter-ready dummy itineraries.
export const itineraries: Itinerary[] = destinations.flatMap((destination, destinationIndex) =>
  seasons.map(({ season, month }, seasonIndex) => {
    const index = destinationIndex * seasons.length + seasonIndex
    return {
      ...destination,
      id: `${destination.place.toLowerCase().replaceAll(' ', '-')}-${season}`,
      title: `${destination.title} · ${season}`,
      season,
      dates: `${4 + ((index + seasonIndex) % 7)} days · ${month}`,
      duration: 4 + ((index + seasonIndex) % 7),
      budgetK: budgets[index % budgets.length],
      match: `${84 + (index % 14)}%`,
    }
  }),
)

// Kept for the existing inspiration carousel.
export const trips = itineraries
