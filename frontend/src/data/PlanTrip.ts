export type TravelDnaPlan = { name: string; detail: string; members: string; color: string; image: string; traits: string[]; travellers: string[]; status: 'ongoing' | 'upcoming' | 'completed' }

export const travelDnaPlans: TravelDnaPlan[] = [
  { name: 'Kyoto autumn escape', detail: 'Food, culture & slow days', members: '4 travellers', color: 'room-blue', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=85', traits: ['Food & culture', 'Slow pace', 'Autumn'], travellers: ['AM', 'RS', 'NK', 'JL'], status: 'upcoming' },
  { name: 'Lisbon long weekend', detail: 'Local gems & golden evenings', members: '2 travellers', color: 'room-mint', image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=800&q=85', traits: ['Hidden gems', 'Nightlife', 'City'], travellers: ['AM', 'SM'], status: 'ongoing' },
  { name: 'Bali reset', detail: 'Temples, waterfalls & unhurried days', members: '3 travellers', color: 'room-blue', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=85', traits: ['Wellness', 'Nature', 'Summer'], travellers: ['AM', 'RS', 'SM'], status: 'completed' },
]
