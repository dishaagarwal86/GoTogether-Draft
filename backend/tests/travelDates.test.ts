import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTravelDates } from '../src/services/travelDates.js'
import { rankRecommendations, type Catalogue, type Preference } from '../src/services/recommendationService.js'
const availability = { start: '2027-01-14', end: '2027-01-17', conflict: false }
test('fixed group dates fill catalogue gaps only when they establish the itinerary dates', () => {
  assert.deepEqual(resolveTravelDates(undefined, 4, availability), { start: availability.start, end: availability.end })
  assert.equal(resolveTravelDates(undefined, 3, availability), undefined)
  assert.equal(resolveTravelDates(undefined, 4, { ...availability, conflict: true }), undefined)
  assert.equal(resolveTravelDates(undefined, 4), undefined)
  assert.equal(resolveTravelDates({ start: '2027-02-29', end: '2027-03-03' }, 3), undefined)
  assert.deepEqual(resolveTravelDates({ start: '2027-02-01', end: '2027-02-04' }, 4, availability), { start: '2027-02-01', end: '2027-02-04' })
})
test('catalogue options carry group travel dates even with no flight or stay data', () => {
  const preference: Preference = { user_id: 'traveller', dates: { ...availability, flexible: false }, budget: 'Moderate', days_count: 4, location_preferences: null, mood_preferences: ['History'], activities_must_have: '', activities_preferred: '', accommodation_preferences: [], data: { pace: 'A balanced mix' } }
  const trip: Catalogue = { id: 'test', title: 'Bangkok', destination: 'Bangkok', country: 'Thailand', duration_days: 4, budget: 'Moderate', estimated_cost_usd: 480, seasons: [], moods: ['History'], location_type: 'City', short_description: '', why_it_fits: '', daily_plan: [], ai_context: {} }
  const result = rankRecommendations([preference], [trip])
  assert.deepEqual(result.allResults[0].travel_dates, { start: '2027-01-14', end: '2027-01-17' })
  assert.equal(trip.travel_dates, undefined, 'Catalogue source stays unchanged')
})
