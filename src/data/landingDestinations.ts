export type LandingDestination = {
  image: string
  place: string
  country: string
}

export const landingDestinations: LandingDestination[] = [
  {
    image: 'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=700&q=85',
    place: 'Amalfi Coast',
    country: 'Italy',
  },
  {
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=700&q=85',
    place: 'Blue Lagoon',
    country: 'Iceland',
  },
  {
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=700&q=85',
    place: 'Ubud Escape',
    country: 'Bali',
  },
]
