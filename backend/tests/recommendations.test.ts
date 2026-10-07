import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rankRecommendations, type Catalogue, type Preference } from '../src/services/recommendationService.js'

const preference = (changes: Partial<Preference> = {}): Preference => ({ budget: 'Moderate', days_count: 5, location_preferences: null, mood_preferences: ['Nature'], activities_must_have: null, activities_preferred: null, accommodation_preferences: [], data: {}, ...changes })
const trip = (id: string, changes: Partial<Catalogue> = {}): Catalogue => ({ id, title: id, destination: id, country: 'Test', duration_days: 5, budget: 'Moderate', estimated_cost_usd: 100, seasons: [], moods: ['Nature'], location_type: 'City', short_description: id, why_it_fits: id, daily_plan: [{ day: 1, morning: 'Cooking class' }], ai_context: {}, ...changes })

test('fewer than three matches never relax budget, duration, or no-go filters', () => {
  const catalogue = [trip('safe'), trip('expensive', { budget: 'Premium' }), trip('long', { duration_days: 12 }), trip('hike', { daily_plan: [{ morning: 'Mountain trek' }] })]
  const ranked = rankRecommendations([preference({ data: { noGo: 'no hiking' } })], catalogue)
  assert.deepEqual(ranked.results.map(item => item.id), ['safe']); assert.ok(ranked.blockers.length)
  assert.deepEqual(rankRecommendations([preference({ days_count: 25 })], catalogue).results, [])
  assert.deepEqual(rankRecommendations([], catalogue).results, [])
})
test('one traveller’s lower budget is preserved and scores remain between zero and 100', () => {
  const members = [preference({ budget: 'Budget-friendly', activities_must_have: 'nature nature nature cooking food walking beach market' }), preference({ budget: 'Premium' })]
  const result = rankRecommendations(members, [trip('affordable', { budget: 'Budget-friendly' }), trip('costly')])
  assert.deepEqual(result.results.map(item => item.id), ['affordable'])
  assert.ok(result.results.every(item => item.score >= 0 && item.score <= 100))
})
test('fair compromise protects the least represented traveller instead of just taking second place', () => {
  const common = { location_preferences: { destination: 'Home' }, data: { pace: 'Slow' } }
  const members = [preference({ ...common, mood_preferences: ['Nature'] }), preference({ ...common, mood_preferences: ['Nature'] }), preference({ ...common, mood_preferences: ['Nightlife'] })]
  const result = rankRecommendations(members, [trip('best', { destination: 'Home', ai_context: { pace: 'Slow' }, moods: ['Nature', 'Nightlife'] }), trip('popular', { destination: 'Home', ai_context: { pace: 'Slow' } }), trip('fair', { moods: ['Nature', 'Nightlife'] }), trip('fresh', { moods: ['Wellness'] })])
  // The popular option has a higher average; fair selection maximises the weakest fit.
  assert.equal(result.results[0].id, 'best')
  assert.equal(result.results[1].id, 'fair')
  assert.equal(new Set(result.results.map(item => item.id)).size, result.results.length)
})
