import '../../backend/src/environment.js'
import { closeDatabase, insertIfMissing } from '../../backend/src/storage.js'

type Place = { destination: string; country: string; location: string; seasons: string[]; anchors: string[] }
const places: Place[] = [
  { destination: 'Santorini', country: 'Greece', location: 'Islands', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['caldera walks', 'volcanic beaches', 'sunset tavernas'] },
  { destination: 'Bali', country: 'Indonesia', location: 'Beach', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['rice terraces', 'temple rituals', 'surf breaks'] },
  { destination: 'Amalfi Coast', country: 'Italy', location: 'Beach', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['coastal paths', 'lemon groves', 'family trattorias'] },
  { destination: 'Kyoto', country: 'Japan', location: 'City', seasons: ['Spring', 'Autumn', 'Winter'], anchors: ['tea houses', 'lantern lanes', 'forest shrines'] },
  { destination: 'Interlaken', country: 'Switzerland', location: 'Mountains', seasons: ['Summer', 'Autumn', 'Winter'], anchors: ['alpine railways', 'lake swims', 'mountain trails'] },
  { destination: 'Marrakech', country: 'Morocco', location: 'City', seasons: ['Spring', 'Autumn', 'Winter'], anchors: ['souks', 'rooftop dinners', 'desert gateways'] },
  { destination: 'Barcelona', country: 'Spain', location: 'City', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['modernist streets', 'market tapas', 'city beaches'] },
  { destination: 'Cappadocia', country: 'Türkiye', location: 'Hidden gems', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['valley hikes', 'cave stays', 'sunrise balloons'] },
  { destination: 'Kerala', country: 'India', location: 'Countryside', seasons: ['Winter', 'Spring', 'Autumn'], anchors: ['backwaters', 'spice gardens', 'Ayurvedic rituals'] },
  { destination: 'Reykjavík', country: 'Iceland', location: 'Hidden gems', seasons: ['Winter', 'Spring', 'Summer'], anchors: ['hot springs', 'waterfalls', 'northern skies'] },
  { destination: 'Queenstown', country: 'New Zealand', location: 'Mountains', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['adventure rivers', 'vineyard lunches', 'ridge walks'] },
  { destination: 'Tulum', country: 'Mexico', location: 'Beach', seasons: ['Winter', 'Spring', 'Autumn'], anchors: ['cenotes', 'Mayan ruins', 'jungle dinners'] },
  { destination: 'Hoi An', country: 'Vietnam', location: 'Countryside', seasons: ['Spring', 'Summer', 'Winter'], anchors: ['lantern workshops', 'river markets', 'cooking gardens'] },
  { destination: 'Cape Town', country: 'South Africa', location: 'City', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['table mountain', 'wine valleys', 'penguin beaches'] },
  { destination: 'Madeira', country: 'Portugal', location: 'Islands', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['levada trails', 'clifftop pools', 'vineyard villages'] },
  { destination: 'Banff', country: 'Canada', location: 'Mountains', seasons: ['Summer', 'Autumn', 'Winter'], anchors: ['turquoise lakes', 'glacier trails', 'fireside lodges'] },
  { destination: 'Zanzibar', country: 'Tanzania', location: 'Islands', seasons: ['Winter', 'Summer', 'Autumn'], anchors: ['spice farms', 'sailing dhows', 'reef swims'] },
  { destination: 'Oaxaca', country: 'Mexico', location: 'Hidden gems', seasons: ['Spring', 'Autumn', 'Winter'], anchors: ['mole kitchens', 'artisan villages', 'mountain ruins'] },
  { destination: 'Edinburgh', country: 'Scotland', location: 'City', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['castle lanes', 'whisky bars', 'literary walks'] },
  { destination: 'Luang Prabang', country: 'Laos', location: 'Countryside', seasons: ['Winter', 'Spring', 'Autumn'], anchors: ['mekong mornings', 'temple alms', 'waterfall pools'] },
  { destination: 'Palawan', country: 'Philippines', location: 'Islands', seasons: ['Winter', 'Spring', 'Summer'], anchors: ['limestone lagoons', 'island hopping', 'reef coves'] },
  { destination: 'Patagonia', country: 'Chile', location: 'Mountains', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['granite trails', 'glacier views', 'remote estancias'] },
  { destination: 'Ubud', country: 'Indonesia', location: 'Countryside', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['yoga shalas', 'rice fields', 'craft studios'] },
  { destination: 'Valletta', country: 'Malta', location: 'Hidden gems', seasons: ['Spring', 'Summer', 'Autumn'], anchors: ['harbour swims', 'baroque streets', 'island ferries'] },
]
const moods = ['Adventure', 'Food & Culture', 'Relaxation', 'Nature', 'Nightlife', 'Wellness']
const budgets = ['Budget-friendly', 'Moderate', 'Premium'] as const
const titles: Record<string, string> = { Adventure: 'Wild horizons & brave detours', 'Food & Culture': 'Local tables & living stories', Relaxation: 'Slow mornings & golden hours', Nature: 'Open skies & untamed trails', Nightlife: 'After-dark flavours & city rhythm', Wellness: 'Restore, roam & reconnect' }

function afternoonFor(mood: string, anchor: string): string {
  if (mood === 'Food & Culture') return `${anchor} — with a local guide and a table somewhere memorable`
  if (mood === 'Wellness') return `${anchor} at your own pace, letting the afternoon breathe`
  if (mood === 'Nature') return `A closer look at ${anchor}, guided by someone who knows the land`
  if (mood === 'Adventure') return `${anchor} — push it a little further while the light is good`
  if (mood === 'Nightlife') return `${anchor} before the evening takes over`
  return `${anchor} — the afternoon version, slower and better`
}

function eveningFor(anchor: string, isLast: boolean): string {
  if (isLast) return `A celebratory final dinner — raise a glass to your crew`
  return `${anchor} as the light changes and the day winds down`
}

async function seedCatalogue() {
try {
for (let index = 0; index < 72; index++) {
  const place = places[index % places.length]; const mood = moods[index % moods.length]; const budget = budgets[Math.floor(index / moods.length) % budgets.length]
  const duration = 3 + (index % 4); const cost = budget === 'Budget-friendly' ? 420 + (index % 5) * 45 : budget === 'Moderate' ? 900 + (index % 5) * 90 : 1750 + (index % 5) * 180
  const id = `catalogue_${String(index + 1).padStart(3, '0')}`
  const dailyPlan = Array.from({ length: duration }, (_, day) => ({
    day: day + 1,
    morning: `${place.anchors[day % 3]} at an easy pace`,
    afternoon: afternoonFor(mood, place.anchors[(day + 1) % 3]),
    evening: eveningFor(place.anchors[(day + 2) % 3], day === duration - 1),
  }))
  const aiContext = { primaryMood: mood, secondaryMoods: [moods[(index + 2) % moods.length]], groupFit: index % 5 === 0 ? ['Families', 'Friends'] : ['Couples', 'Friends'], pace: index % 3 === 0 ? 'Slow & relaxed' : index % 3 === 1 ? 'A balanced mix' : 'Busy & activity-filled', highlights: place.anchors, avoidIf: mood === 'Adventure' ? ['Limited mobility'] : ['None'] }
  await insertIfMissing('itinerary_catalogue', {
    id, title: `${place.destination} · ${titles[mood]}`, destination: place.destination, country: place.country,
    duration_days: duration, budget, estimated_cost_usd: cost, seasons: place.seasons,
    moods: [mood, moods[(index + 2) % moods.length]], location_type: place.location,
    short_description: `${duration} days shaped around ${place.anchors.join(', ')}.`,
    why_it_fits: `Best for groups seeking ${mood.toLowerCase()} with a ${budget.toLowerCase()} comfort level.`,
    daily_plan: dailyPlan, ai_context: aiContext,
  })
}

console.log('Seeded 72 itinerary catalogue records.')
} finally {
  await closeDatabase()
}
}

seedCatalogue().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Catalogue seed failed.')
  process.exitCode = 1
})
