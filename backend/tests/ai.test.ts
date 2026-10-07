import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Responses } from 'openai/resources/responses/responses'
import { generateAi, resolveAiConfig } from '../src/services/aiProvider.js'
import { fallbackExtraction, parseCompanionRequest, validateReply } from '../src/services/companionService.js'
import { validateStory } from '../src/services/personalisationService.js'
import { validateExtracted, violatesNoGo } from '../src/services/travelPreferences.js'

test('provider selection is consistent, explicit, and case insensitive', () => {
  assert.equal(resolveAiConfig({}), undefined)
  assert.equal(resolveAiConfig({ AI_PROVIDER: ' OLLAMA ', OLLAMA_API_KEY: 'test' })?.provider, 'ollama')
  assert.equal(resolveAiConfig({ OPENAI_API_KEY: 'test' })?.provider, 'openai')
  assert.equal(resolveAiConfig({ OLLAMA_API_KEY: 'test', OPENAI_API_KEY: 'test' })?.provider, 'ollama')
  assert.equal(resolveAiConfig({ AI_PROVIDER: 'openai', OLLAMA_API_KEY: 'test' }), undefined)
  assert.throws(() => resolveAiConfig({ AI_PROVIDER: 'unknown' }))
})
test('requests and generated preferences reject unsupported or unbounded data', () => {
  assert.throws(() => parseCompanionRequest({ task: 'chat', roomId: 'room', message: 'a'.repeat(4001) }))
  assert.throws(() => parseCompanionRequest({ task: 'extract', message: 'food' }))
  assert.throws(() => validateExtracted({ userId: 'someone-else' }))
  assert.throws(() => validateExtracted({ daysCount: 999 }))
  assert.throws(() => validateExtracted({ moods: ['Invented interest'] }))
  assert.throws(() => validateReply({ summary: 'hello', extracted: {} }, 'chat'))
  assert.deepEqual(fallbackExtraction('Food and nature. No hiking. A relaxed pace.'), { moods: ['Food & Culture', 'Nature'], pace: 'Slow & relaxed', noGo: 'No hiking' })
})
test('itinerary notes cannot add or reorder days or replace activities', () => {
  const story = { resultTitle: 'Our trip', scrapbookIntro: 'Enjoy it together.', whyItWorks: ['Food'], tradeoffNote: 'Discuss the pace.', days: [{ day: 1, note: 'Leave time for a break.' }] }
  assert.deepEqual(validateStory(story, 1), story)
  assert.throws(() => validateStory(story, 2))
  assert.throws(() => validateStory({ ...story, days: [{ day: 2, note: 'Oops' }] }, 1))
  assert.throws(() => validateStory({ ...story, destination: 'Elsewhere' }, 1))
  assert.throws(() => validateStory({ ...story, days: [{ day: 1, note: 'Hello', morning: 'Fly away' }] }, 1))
})
test('multiword no-go phrases match activity variants', () => {
  assert.equal(violatesNoGo('no hiking', 'A mountain trek'), true)
  assert.equal(violatesNoGo('early starts, long drives', 'Sunrise at the lake'), true)
  assert.equal(violatesNoGo('no hiking', 'A local cooking class'), false)
  assert.equal(violatesNoGo('none', 'Sunrise hike'), false)
})
test('provider calls enforce bounds and expose failures as fallbacks without network traffic', async t => {
  const keys = ['AI_PROVIDER', 'OPENAI_API_KEY', 'OLLAMA_API_KEY']
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  let behavior: 'valid' | 'json' | 'schema' | 'timeout' = 'valid'
  let calls = 0
  t.mock.method(console, 'warn', () => {})
  t.mock.method(Responses.prototype, 'create', async function (this: any, request: any, options: any) {
    calls++
    assert.equal(request.max_output_tokens, 6000)
    assert.ok(options.signal instanceof AbortSignal)
    assert.equal(this._client.timeout, 45000)
    assert.equal(this._client.maxRetries, 0)
    assert.equal(request.input[0].role, 'system')
    assert.equal(request.input[1].role, 'user')
    if (process.env.AI_PROVIDER === 'ollama') assert.equal(this._client.baseURL, 'https://ollama.com/v1')
    if (behavior === 'timeout') throw new DOMException('Timed out', 'TimeoutError')
    return { output_text: behavior === 'json' ? 'not json' : JSON.stringify(behavior === 'schema' ? { summary: 22 } : { summary: 'A grounded suggestion.' }) }
  })
  const run = () => generateAi('Return a summary.', { notes: 'travel data' }, value => validateReply(value, 'chat'), { summary: 'Local suggestion.' })
  try {
    process.env.OPENAI_API_KEY = 'synthetic-key'; process.env.OLLAMA_API_KEY = 'synthetic-key'
    for (const provider of ['openai', 'ollama']) {
      process.env.AI_PROVIDER = provider
      assert.equal((await run()).source, provider)
    }
    for (const mode of ['json', 'schema', 'timeout'] as const) {
      behavior = mode
      const reply = await run()
      assert.equal(reply.source, 'fallback'); assert.ok(reply.notice); assert.equal(reply.value.summary, 'Local suggestion.')
    }
    const before = calls
    process.env.OLLAMA_API_KEY = ''; process.env.OPENAI_API_KEY = ''
    assert.equal((await run()).source, 'fallback'); assert.equal(calls, before)
  } finally { for (const key of keys) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key] } }
})

test('near-JSON from reasoning models is repaired before validation', async () => {
  const { extractJson } = await import('../src/services/aiProvider.js')
  assert.deepEqual(extractJson('```json\n{"summary":"ok"}\n```'), { summary: 'ok' })
  const days = (extractJson('{"days":[{"day":1,"a":{"x":1}},"{day":2,"b":1},{"day":3,"c":{"y":1}},"day":4,\\u0022d\\u0022:1}]}') as { days: Array<{ day: number }> }).days
  assert.deepEqual(days.map(day => day.day), [1, 2, 3, 4])
})

test('AI itineraries keep stay nights within the trip length', async () => {
  const { mergePlannerPreferences, normaliseItineraries } = await import('../src/services/aiItineraryService.js')
  const merged = mergePlannerPreferences([{ budget: 'Moderate', days_count: 3, dates: { start: '2026-11-01', end: '2026-11-30' }, location_preferences: { destination: 'Japan' }, mood_preferences: [], activities_must_have: null, activities_preferred: null, accommodation_preferences: [], data: {} }])
  const [trip] = normaliseItineraries({ itineraries: [{ destination: 'Osaka', travel_dates: { start: '2026-11-10', end: '2026-11-30' }, days: [{}, {}, {}], stays: [{ name: 'Inn', price_per_night: 100 }] }] }, merged)
  assert.equal(trip.stays[0].nights, 3)
  assert.equal(trip.stays[0].totalPrice, 300)
  assert.equal(trip.travel_dates.end, '2026-11-13')
})
