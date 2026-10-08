import assert from 'node:assert/strict'
import { test } from 'node:test'
import { realPlaces } from '../src/data/realPlaces.js'
import { placesForDestination, plannerPlaceContext, resolveRealPlace, searchRealPlaces } from '../src/services/realPlaceService.js'
import { applyPlanCommand, type PlanDocument } from '../src/services/workingPlan.js'
import { mergePlannerPreferences, normaliseItineraries } from '../src/services/aiItineraryService.js'

test('editorial inventory has unique identities, sources and six destination collections', () => {
  assert.equal(realPlaces.length, 30)
  assert.equal(new Set(realPlaces.map(place => place.id)).size, 30)
  assert.equal(new Set(realPlaces.map(place => place.destination)).size, 6)
  assert.equal(realPlaces.filter(place => place.kind === 'stay').length, 6)
  for (const place of realPlaces) {
    assert.equal(new URL(place.source.url).protocol, 'https:')
    assert.equal(place.source.placeId, place.id)
    assert.equal(place.source.name, place.name)
    assert.equal(place.source.scope, 'identity')
    assert.match(place.source.checkedAt, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(place.source.publisher && place.summary && place.area)
    assert.equal('price' in place || 'rating' in place || 'openingHours' in place, false)
  }
})

test('geographic matching avoids substring and country collisions; searches tolerate accents', () => {
  assert.equal(placesForDestination('Kyoto, Japan', 'Japan').length, 5)
  assert.equal(placesForDestination('Kyoto', 'United States').length, 0)
  assert.equal(placesForDestination('Kyoto, United States').length, 0)
  assert.equal(placesForDestination('Not Kyoto').length, 0)
  assert.equal(placesForDestination('Ubud').some(place => place.id === 'bali-uluwatu'), false)
  assert.equal(placesForDestination('Munnar', 'India').length, 0)
  assert.equal(placesForDestination('Kochi', 'India').length, 5)
  assert.equal(searchRealPlaces('Barcelona', 'Spain', 'park guell')[0].title, 'Park Güell')
  assert.deepEqual(searchRealPlaces('Kyoto', 'Japan', 'imaginary resort'), [])
  assert.ok(plannerPlaceContext(['Japan']).every(place => place.country === 'Japan'))
  assert.deepEqual(plannerPlaceContext(['Atlantis']), [])
})

test('source identity requires a matching ID, name, geography and activity kind', () => {
  assert.equal(resolveRealPlace('kyoto-nishiki-market', 'Nishiki Market', 'Kyoto', 'Japan', 'food')?.source.publisher, 'Nishiki Market Shopping District')
  for (const args of [
    ['invented', 'Nishiki Market', 'Kyoto', 'Japan', 'food'],
    ['kyoto-nishiki-market', 'Invented Market', 'Kyoto', 'Japan', 'food'],
    ['kyoto-nishiki-market', 'Nishiki Market', 'Osaka', 'Japan', 'food'],
    ['kyoto-nishiki-market', 'Nishiki Market', 'Kyoto', 'Japan', 'stay'],
  ] as const) assert.equal(resolveRealPlace(...args), undefined)
})

test('saved source links are server-owned, survive rescheduling, and disappear on replacement', () => {
  const document: PlanDocument = { title: 'Kyoto', destination: 'Kyoto', country: 'Japan', catalogueId: 'test', days: [{ id: 'day-1', title: 'Day 1', items: [] }] }
  const command = { type: 'add', dayId: 'day-1', title: 'Nishiki Market', kind: 'food', time: '12:00', duration: 60, note: 'Lunch', placeId: 'kyoto-nishiki-market', placeSource: { url: 'https://evil.invalid' } }
  const added = applyPlanCommand(document, command).document
  const item = added.days[0].items[0]
  assert.equal(item.placeSource?.url, 'https://www.kyoto-nishiki.or.jp/en/')
  const edited = applyPlanCommand(added, { ...command, type: 'update', itemId: item.id, time: '13:00' }).document
  assert.deepEqual(edited.days[0].items[0].placeSource, item.placeSource)
  const replaced = applyPlanCommand(edited, { ...command, type: 'update', itemId: item.id, title: 'A different market' }).document
  assert.equal(replaced.days[0].items[0].placeSource, undefined)
  assert.equal(replaced.days[0].items[0].imageQuery, undefined)
  assert.equal(applyPlanCommand(document, { ...command, placeId: 'made-up' }).document.days[0].items[0].placeSource, undefined)
  assert.equal(applyPlanCommand(document, { ...command, title: 'A different market' }).document.days[0].items[0].placeSource, undefined)
})

test('AI output cannot forge a citation, confuse a hotel with an activity or bless prices', () => {
  const merged = mergePlannerPreferences([{ budget: 'Moderate', days_count: 2, location_preferences: { destination: 'Kyoto' }, mood_preferences: [], activities_must_have: null, activities_preferred: null, accommodation_preferences: [], data: {} }])
  const raw = { destination: 'Kyoto', country: 'Japan', days: Array.from({ length: 2 }, () => ({
    morning: { activity: 'Nishiki Market', place_id: 'kyoto-nishiki-market', placeSource: { url: 'https://evil.invalid' } },
    afternoon: { activity: 'Not the referenced temple', place_id: 'kyoto-kiyomizu-dera' },
    evening: { activity: 'Hyatt Regency Kyoto', place_id: 'kyoto-hyatt-regency' },
  })), stays: [{ name: 'Hyatt Regency Kyoto', place_id: 'kyoto-hyatt-regency', price_per_night: 150, stars: 5, review_score: 9.9 }, { name: 'Invented hotel', place_id: 'kyoto-hyatt-regency' }] }
  const [trip] = normaliseItineraries([raw], merged)
  assert.equal(trip.days[0].slots.morning.placeSource?.url, 'https://www.kyoto-nishiki.or.jp/en/')
  assert.equal(trip.days[0].slots.afternoon.placeSource, undefined)
  assert.equal(trip.days[0].slots.evening.placeSource, undefined)
  assert.equal(trip.stays[0].placeSource?.scope, 'identity')
  assert.equal(trip.stays[0].reviewScore, 0)
  assert.equal(trip.stays[1].placeSource, undefined)
})
