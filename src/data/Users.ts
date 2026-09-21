import type { Mood, Season } from './trips'

export type User = {
  id: string
  name: string
  email: string
  initials: string
  avatar: string
  homeCity: string
  joinedAt: string
  bio: string
  preferences: {
    moods: Mood[]
    seasons: Season[]
    budgetK: { min: number; max: number }
  }
}

const avatar = (seed: string) => `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${seed}`

// All names, profiles, and email addresses below are fictional development data.
export const users: User[] = [
  { id: 'usr_alex', name: 'Alex Morgan', email: 'alex.morgan@example.test', initials: 'AM', avatar: avatar('Alex'), homeCity: 'Bengaluru, India', joinedAt: '2026-01-12', bio: 'Always planning the next long weekend.', preferences: { moods: ['nature', 'adventure'], seasons: ['spring', 'autumn'], budgetK: { min: 40, max: 180 } } },
  { id: 'usr_sam', name: 'Samira Khan', email: 'samira.khan@example.test', initials: 'SK', avatar: avatar('Samira'), homeCity: 'Mumbai, India', joinedAt: '2026-02-03', bio: 'Food-first traveler and sunset collector.', preferences: { moods: ['nightlife', 'nature'], seasons: ['summer', 'winter'], budgetK: { min: 30, max: 120 } } },
  { id: 'usr_arthur', name: 'Arthur Chen', email: 'arthur.chen@example.test', initials: 'AC', avatar: avatar('Arthur'), homeCity: 'Singapore', joinedAt: '2026-02-18', bio: 'Will hike for a better view.', preferences: { moods: ['adventure', 'nature'], seasons: ['spring', 'winter'], budgetK: { min: 70, max: 250 } } },
  { id: 'usr_maya', name: 'Maya Iyer', email: 'maya.iyer@example.test', initials: 'MI', avatar: avatar('Maya'), homeCity: 'Pune, India', joinedAt: '2026-03-04', bio: 'Museum days, jazz nights.', preferences: { moods: ['nightlife'], seasons: ['autumn', 'rainy'], budgetK: { min: 25, max: 100 } } },
  { id: 'usr_noah', name: 'Noah Wilson', email: 'noah.wilson@example.test', initials: 'NW', avatar: avatar('Noah'), homeCity: 'Melbourne, Australia', joinedAt: '2026-03-11', bio: 'Ocean swims and tiny bookshops.', preferences: { moods: ['nature', 'adventure'], seasons: ['summer', 'spring'], budgetK: { min: 80, max: 300 } } },
  { id: 'usr_zoe', name: 'Zoë Martin', email: 'zoe.martin@example.test', initials: 'ZM', avatar: avatar('Zoe'), homeCity: 'Paris, France', joinedAt: '2026-03-22', bio: 'Here for the bakery and the afterparty.', preferences: { moods: ['nightlife'], seasons: ['summer', 'autumn'], budgetK: { min: 90, max: 250 } } },
  { id: 'usr_diego', name: 'Diego Santos', email: 'diego.santos@example.test', initials: 'DS', avatar: avatar('Diego'), homeCity: 'Lisbon, Portugal', joinedAt: '2026-04-06', bio: 'Surfer, map nerd, excellent snack packer.', preferences: { moods: ['adventure', 'nature'], seasons: ['summer', 'rainy'], budgetK: { min: 20, max: 130 } } },
  { id: 'usr_hana', name: 'Hana Lee', email: 'hana.lee@example.test', initials: 'HL', avatar: avatar('Hana'), homeCity: 'Seoul, South Korea', joinedAt: '2026-04-15', bio: 'Finds the best cafés in every city.', preferences: { moods: ['nightlife', 'nature'], seasons: ['spring', 'autumn'], budgetK: { min: 50, max: 180 } } },
  { id: 'usr_oliver', name: 'Oliver Grant', email: 'oliver.grant@example.test', initials: 'OG', avatar: avatar('Oliver'), homeCity: 'London, United Kingdom', joinedAt: '2026-05-02', bio: 'Ski trips and scenic train rides.', preferences: { moods: ['adventure'], seasons: ['winter', 'autumn'], budgetK: { min: 100, max: 500 } } },
  { id: 'usr_aisha', name: 'Aisha Rahman', email: 'aisha.rahman@example.test', initials: 'AR', avatar: avatar('Aisha'), homeCity: 'Dubai, UAE', joinedAt: '2026-05-21', bio: 'Slow travel, local craft, long lunches.', preferences: { moods: ['nature'], seasons: ['winter', 'spring'], budgetK: { min: 60, max: 220 } } },
  { id: 'usr_luca', name: 'Luca Bianchi', email: 'luca.bianchi@example.test', initials: 'LB', avatar: avatar('Luca'), homeCity: 'Milan, Italy', joinedAt: '2026-06-03', bio: 'Never says no to a mountain road.', preferences: { moods: ['adventure', 'nightlife'], seasons: ['summer', 'winter'], budgetK: { min: 75, max: 260 } } },
  { id: 'usr_priya', name: 'Priya Nair', email: 'priya.nair@example.test', initials: 'PN', avatar: avatar('Priya'), homeCity: 'Kochi, India', joinedAt: '2026-06-28', bio: 'Rainy-day walks and regional food.', preferences: { moods: ['nature'], seasons: ['rainy', 'winter'], budgetK: { min: 10, max: 75 } } },
]

export const friendGroups = [
  { id: 'grp_office', name: 'Office friends', memberIds: ['usr_alex', 'usr_sam', 'usr_arthur', 'usr_maya'] },
  { id: 'grp_school', name: 'School friends', memberIds: ['usr_alex', 'usr_noah', 'usr_zoe'] },
  { id: 'grp_weekends', name: 'Weekend explorers', memberIds: ['usr_alex', 'usr_diego', 'usr_hana', 'usr_aisha', 'usr_luca', 'usr_priya'] },
]

export const currentUser = users[0]
