import { assertQuestMember, HttpError } from './access.js'
import { aiHistory, contextKey, reserveAiRequest, saveAiRecord } from './aiHistory.js'
import { generateAi } from './aiProvider.js'
import { recommendForQuest } from './recommendationService.js'
import { record, strings, text } from './travelPreferences.js'

export type Story = { resultTitle: string; scrapbookIntro: string; whyItWorks: string[]; tradeoffNote: string; days: Array<{ day: number; note: string }> }
export function validateStory(value: unknown, dayCount: number): Story {
  const input = record(value)
  if (Object.keys(input).some(key => !['resultTitle', 'scrapbookIntro', 'whyItWorks', 'tradeoffNote', 'days'].includes(key))) throw new Error('Unexpected story field.')
  if (!Array.isArray(input.days) || input.days.length !== dayCount) throw new Error('Story must preserve the itinerary length.')
  const days = input.days.map((value, index) => {
    const day = record(value)
    if (day.day !== index + 1 || Object.keys(day).some(key => !['day', 'note'].includes(key))) throw new Error('Story must preserve day order.')
    return { day: index + 1, note: text(day.note, 600) }
  })
  return { resultTitle: text(input.resultTitle, 150), scrapbookIntro: text(input.scrapbookIntro, 1200), whyItWorks: strings(input.whyItWorks, 5, 500), tradeoffNote: text(input.tradeoffNote, 800), days }
}
async function storyContext(userId: string, input: unknown) {
  const request = record(input)
  const roomId = text(request.roomId, 150)
  const itineraryId = text(request.itineraryId, 150)
  await assertQuestMember(roomId, userId)
  const plan = await recommendForQuest(roomId)
  const trip = plan.allResults.find(item => item.id === itineraryId)
  if (!trip) throw new HttpError(409, 'This itinerary no longer matches the quest. Refresh your travel ideas.')
  const context = { group: plan.travelDna, trip, preferenceVersion: plan.preferenceVersion }
  return { roomId, trip, context, key: contextKey({ version: 1, ...context }) }
}
export async function savedStory(userId: string, input: unknown) {
  const { roomId, key } = await storyContext(userId, input)
  const [saved] = await aiHistory(userId, roomId, 'personalise', key)
  return saved ? { id: saved.id, ...saved.data } : null
}
export async function personalise(userId: string, input: unknown) {
  const { roomId, trip, context, key } = await storyContext(userId, input)
  const [saved] = await aiHistory(userId, roomId, 'personalise', key)
  // A fallback is saved for refresh continuity, but the user can retry it.
  if (saved && saved.data.source !== 'fallback') return { id: saved.id, ...saved.data }
  await reserveAiRequest(userId)
  const dayCount = Array.isArray(trip.daily_plan) ? trip.daily_plan.length : 0
  const fallback: Story = { resultTitle: trip.title, scrapbookIntro: trip.short_description, whyItWorks: trip.matchedPreferences, tradeoffNote: trip.compromises.join(' '), days: Array.from({ length: dayCount }, (_, index) => ({ day: index + 1, note: 'Use the curated plan above as your starting point, and agree on the pace with your crew.' })) }
  const result = await generateAi('You add personal notes to an existing curated itinerary. Never replace its destination, duration, budget, or activities. Never invent prices, availability, schedules or bookings. Respect the supplied no-go activities. Explain the supplied matches and compromises, without inventing scores. Return JSON with resultTitle (short title), scrapbookIntro, whyItWorks (up to 5 strings), tradeoffNote, and days (one entry per supplied day, in order, with only day (number) and note (short planning advice)).', context, value => validateStory(value, dayCount), fallback)
  const data = { ...result.value, source: result.source, notice: result.notice, itineraryId: trip.id }
  const item = await saveAiRecord(userId, roomId, 'personalise', key, data)
  return { id: item.id, ...data }
}
