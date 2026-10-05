export type TravellerProfile = { name: string; initials: string; moods: string[]; budget: string; pace: string; mustHave: string }

export const demoTravellers: TravellerProfile[] = [
  { name: 'Aisha', initials: 'A', moods: ['Food & Culture', 'Nature'], budget: 'Moderate', pace: 'A balanced mix', mustHave: 'Street food and a sunset' },
  { name: 'Maya', initials: 'M', moods: ['Relaxation', 'Wellness'], budget: 'Moderate', pace: 'Slow & relaxed', mustHave: 'Time near the water' },
  { name: 'Rohan', initials: 'R', moods: ['Adventure', 'Nature'], budget: 'Premium', pace: 'Busy & activity-filled', mustHave: 'One active outdoor day' },
]
