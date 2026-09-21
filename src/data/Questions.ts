export type Question = { id: string; title: string; kind: 'options' | 'text' | 'date' | 'number'; options?: string[]; helper?: string }

export const questions: Question[] = [
  { id: 'kids', title: 'Are you traveling with kids?', kind: 'options', options: ['Yes', 'No'] },
  { id: 'kidsAge', title: 'What are the ages of the kids?', kind: 'text', helper: 'Separate multiple ages with commas, for example: 4, 8' },
  { id: 'medical', title: 'Any medical conditions we should consider?', kind: 'text', helper: 'Share only what your group needs the planner to know.' },
  { id: 'considerations', title: 'Any other considerations?', kind: 'text', helper: 'Accessibility, mobility, allergies, or anything else.' },
  { id: 'accommodation', title: 'What kind of accommodation feels right?', kind: 'options', options: ['Hotel', 'Villa', 'Dormitory', 'Resort', 'Apartment'] },
  { id: 'activities', title: 'What would you like to do?', kind: 'options', options: ['Activities', 'Food & culture', 'Relaxation', 'Shopping', 'Nightlife'] },
  { id: 'location', title: 'What kind of location are you drawn to?', kind: 'options', options: ['City', 'Beach', 'Mountains', 'Nature', 'Countryside'] },
  { id: 'food', title: 'What should we know about food?', kind: 'options', options: ['No preference', 'Vegetarian', 'Vegan', 'Halal', 'Allergies'] },
  { id: 'dates', title: 'When would you like to travel?', kind: 'date' },
  { id: 'days', title: 'How many days are you thinking?', kind: 'number' },
  { id: 'budget', title: 'What should the budget feel like?', kind: 'options', options: ['Keep it light', 'Comfortable', 'Make it memorable'] },
]
