export const tripsPageContent = { eyebrow: 'Your adventures', title: 'My quests' }

export type QuestStatus = 'ongoing' | 'upcoming' | 'completed'
export type QuestSummary = { id: string; status: QuestStatus; destination: string; country: string; title: string; dates: string; travellers: string; image: string; progress?: string }

export const questSummaries: QuestSummary[] = [
  { id: 'lisbon', status: 'ongoing', destination: 'Lisbon', country: 'Portugal', title: 'Atlantic city glow', dates: 'Day 2 of 4 · 12–15 Oct', travellers: 'Alex, Sam + 2', progress: 'Halfway through', image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=900&q=85' },
  { id: 'kyoto', status: 'upcoming', destination: 'Kyoto', country: 'Japan', title: 'Lantern-lit Kyoto', dates: '04–09 Nov · 5 nights', travellers: 'Alex, Riya, Noah, Jules', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=85' },
  { id: 'amalfi', status: 'upcoming', destination: 'Amalfi Coast', country: 'Italy', title: 'Coastal slow days', dates: '18–22 May · 4 nights', travellers: 'Alex + 1', image: 'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=900&q=85' },
  { id: 'bali', status: 'completed', destination: 'Bali', country: 'Indonesia', title: 'Rainforest reset', dates: '06–12 Aug 2026', travellers: 'Alex, Sam, Riya', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=85' },
]
