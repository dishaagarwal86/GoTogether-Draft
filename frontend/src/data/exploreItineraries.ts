export type DailyPlan = { day: string; morning: string; afternoon: string; evening: string }

export type ExploreItinerary = {
  id: string
  title: string
  destination: string
  country: string
  image: string
  duration: string
  budget: 'Budget-friendly' | 'Moderate' | 'Premium'
  seasons: string[]
  moods: string[]
  locationType: string
  matchScore: number
  shortDescription: string
  whyItFits: string
  dailyPlan: DailyPlan[]
}

const plan = (place: string): DailyPlan[] => [
  { day: 'Day 1', morning: `Arrive slowly and settle into ${place}`, afternoon: 'A guided walk through the neighbourhood', evening: 'A long local dinner with sunset views' },
  { day: 'Day 2', morning: 'An unhurried signature experience', afternoon: 'Free time for wandering or resting', evening: 'A handpicked table or rooftop drink' },
  { day: 'Day 3', morning: 'A scenic escape beyond the city', afternoon: 'A flavours-and-stories local stop', evening: 'Golden hour and a relaxed night out' },
  { day: 'Day 4', morning: 'One last slow breakfast', afternoon: 'A final market browse before departure', evening: 'Travel home with a fuller camera roll' },
]

export const exploreItineraries: ExploreItinerary[] = [
  { id: 'santorini', title: 'Aegean light & slow sunsets', destination: 'Santorini', country: 'Greece', image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=85', duration: '4 days', budget: 'Premium', seasons: ['Spring', 'Summer', 'Autumn'], moods: ['Relaxation', 'Food & Culture'], locationType: 'Islands', matchScore: 94, shortDescription: 'Clifftop swims, volcanic wines, and blue-hour dinners.', whyItFits: 'A gentle pace with memorable food and plenty of time together.', dailyPlan: plan('Santorini') },
  { id: 'bali', title: 'Jungle rituals & ocean ease', destination: 'Bali', country: 'Indonesia', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=85', duration: '6 days', budget: 'Moderate', seasons: ['Spring', 'Summer'], moods: ['Wellness', 'Nature', 'Relaxation'], locationType: 'Hidden gems', matchScore: 92, shortDescription: 'Rice terraces, temple mornings, and sea-side spa time.', whyItFits: 'Balances restorative downtime with just enough discovery.', dailyPlan: plan('Bali') },
  { id: 'amalfi', title: 'Coastal flavours & sunset trails', destination: 'Amalfi Coast', country: 'Italy', image: 'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=1200&q=85', duration: '5 days', budget: 'Premium', seasons: ['Spring', 'Summer', 'Autumn'], moods: ['Food & Culture', 'Relaxation'], locationType: 'Beach', matchScore: 91, shortDescription: 'Lemon groves, boat days, and a table by the Tyrrhenian Sea.', whyItFits: 'For groups who want every meal and view to feel cinematic.', dailyPlan: plan('the Amalfi Coast') },
  { id: 'kyoto', title: 'Tea houses & autumn lanterns', destination: 'Kyoto', country: 'Japan', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=85', duration: '5 days', budget: 'Moderate', seasons: ['Spring', 'Autumn'], moods: ['Food & Culture', 'Wellness'], locationType: 'City', matchScore: 95, shortDescription: 'Quiet shrines, intimate tastings, and lantern-lit lanes.', whyItFits: 'A culture-rich rhythm that still leaves space to breathe.', dailyPlan: plan('Kyoto') },
  { id: 'interlaken', title: 'Alpine air & lake days', destination: 'Interlaken', country: 'Switzerland', image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85', duration: '4 days', budget: 'Premium', seasons: ['Summer', 'Autumn', 'Winter'], moods: ['Adventure', 'Nature'], locationType: 'Mountains', matchScore: 90, shortDescription: 'Cable cars, glacier views, and emerald lake swims.', whyItFits: 'High-energy days pair beautifully with cosy alpine evenings.', dailyPlan: plan('Interlaken') },
  { id: 'marrakech', title: 'Spice markets & desert glow', destination: 'Marrakech', country: 'Morocco', image: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=85', duration: '4 days', budget: 'Moderate', seasons: ['Spring', 'Autumn', 'Winter'], moods: ['Food & Culture', 'Hidden gems'], locationType: 'City', matchScore: 89, shortDescription: 'Riads, craft ateliers, and a night under desert stars.', whyItFits: 'An immersive, sensory reset for curious groups.', dailyPlan: plan('Marrakech') },
  { id: 'barcelona', title: 'Midnight tapas & modernist curves', destination: 'Barcelona', country: 'Spain', image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1200&q=85', duration: '4 days', budget: 'Moderate', seasons: ['Spring', 'Summer', 'Autumn'], moods: ['Nightlife', 'Food & Culture'], locationType: 'City', matchScore: 88, shortDescription: 'Beach afternoons, bold architecture, and late tapas.', whyItFits: 'For friends who want culture by day and energy after dark.', dailyPlan: plan('Barcelona') },
  { id: 'cappadocia', title: 'Balloon skies & cave tables', destination: 'Cappadocia', country: 'Türkiye', image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=85', duration: '3 days', budget: 'Moderate', seasons: ['Spring', 'Summer', 'Autumn'], moods: ['Adventure', 'Nature'], locationType: 'Hidden gems', matchScore: 93, shortDescription: 'Sunrise balloons, soft valleys, and intimate cave stays.', whyItFits: 'A compact escape with a truly once-in-a-lifetime moment.', dailyPlan: plan('Cappadocia') },
  { id: 'kerala', title: 'Backwater calm & spice gardens', destination: 'Kerala', country: 'India', image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=85', duration: '5 days', budget: 'Budget-friendly', seasons: ['Winter', 'Spring'], moods: ['Nature', 'Wellness', 'Relaxation'], locationType: 'Countryside', matchScore: 90, shortDescription: 'Houseboats, Ayurveda, and slow mornings among palms.', whyItFits: 'Restorative and affordable without sacrificing richness.', dailyPlan: plan('Kerala') },
  { id: 'iceland', title: 'Fire, ice & northern skies', destination: 'Iceland', country: 'Iceland', image: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?auto=format&fit=crop&w=1200&q=85', duration: '6 days', budget: 'Premium', seasons: ['Winter', 'Summer'], moods: ['Adventure', 'Nature'], locationType: 'Hidden gems', matchScore: 96, shortDescription: 'Waterfalls, geothermal lagoons, and wild open roads.', whyItFits: 'Made for groups who bond over beautiful, big-sky adventures.', dailyPlan: plan('Iceland') },
]
