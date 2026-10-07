import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { Responses } from 'openai/resources/responses/responses'
import { app } from '../src/app.js'
import { registerUser } from '../src/services/authService.js'
import { createRoom } from '../src/services/roomService.js'
import { createQuestMessage } from '../src/services/chatService.js'
import { reserveAiRequest } from '../src/services/aiHistory.js'
import { recommendForQuest } from '../src/services/recommendationService.js'
import * as entities from '../src/services/apiStore.js'
import { closeDatabase, deleteRows, selectRows, upsertRow } from '../src/storage.js'

test(`AI HTTP and persistence contract (${process.env.DATABASE_PROVIDER})`, async t => {
  assert.equal(process.env.DATABASE_URL, 'postgres://provider_test:provider_test@127.0.0.1:55436/gotogether_provider_test')
  assert.equal(process.env.NODE_ENV, 'test')
  assert.equal(process.env.OPENAI_API_KEY, '')
  assert.equal(process.env.OLLAMA_API_KEY, '')
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address() as { port: number }
  const request = async (path: string, token?: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, body: await response.json() }
  }
  const users: string[] = []
  let roomId = ''
  const originalProvider = process.env.AI_PROVIDER
  try {
    const owner = await registerUser({ firstName: 'AI', lastName: 'Owner', email: `ai-${randomUUID()}@example.invalid`, password: 'Synthetic password 2026!' }); users.push(owner.user.id)
    const other = await registerUser({ firstName: 'AI', lastName: 'Member', email: `ai-${randomUUID()}@example.invalid`, password: 'Synthetic password 2026!' }); users.push(other.user.id)
    roomId = (await createRoom({ name: 'AI fixture', tripName: 'A shared trip', ownerId: owner.user.id, members: 2 })).id
    const pref = await entities.create('preferences', 'pref_ai', { userId: owner.user.id, tripRoomId: roomId, budget: 'Premium', daysCount: 6, moodPreferences: ['Food & Culture'], dates: { flexible: true }, submitted: true })
    let suggestion = ''
    let firstChat = ''
    await t.test('AI and recommendation endpoints require authentication and membership', async () => {
      assert.equal((await request('/companion', undefined, { task: 'chat', roomId, message: 'Hello' })).status, 401)
      assert.equal((await request('/personalise-itinerary', undefined, {})).status, 401)
      assert.equal((await request('/itineraries/ai-generate', undefined, { roomId })).status, 401)
      assert.equal((await request('/itineraries/ai-generate', other.token, { roomId })).status, 403)
      assert.equal((await request('/itineraries/ai-generate', owner.token, { roomId })).status, 409)
      assert.equal((await request(`/recommendations/quests/${roomId}`)).status, 401)
      assert.equal((await request('/companion', other.token, { task: 'chat', roomId, message: 'Hello' })).status, 403)
      assert.equal((await request(`/companion/history?roomId=${roomId}`, other.token)).status, 403)
      assert.equal((await request(`/personalise-itinerary?roomId=${roomId}&itineraryId=unknown`, other.token)).status, 403)
    })
    await t.test('preference endpoints reject cross-user access and room moves', async () => {
      assert.equal((await request(`/users/${owner.user.id}/preferences`, other.token)).status, 403)
      assert.equal((await request(`/users/${other.user.id}/preferences/${pref.id}`, other.token, { budget: 'Premium' }, 'PATCH')).status, 404)
      assert.equal((await request(`/users/${owner.user.id}/preferences/${pref.id}`, owner.token, { tripRoomId: 'another-room' }, 'PATCH')).status, 400)
      assert.equal((await request(`/users/${other.user.id}/preferences`, other.token, { tripRoomId: roomId })).status, 403)
      assert.equal((await request(`/users/${owner.user.id}/preferences/${pref.id}`, owner.token, { moodPreferences: 'invalid array' }, 'PATCH')).status, 400)
      assert.equal((await request(`/users/${owner.user.id}/preferences/${pref.id}`, owner.token, { daysCount: -4 }, 'PATCH')).status, 400)
    })
    await t.test('merged catalogue and departure-city features use either database provider', async () => {
      const catalogue = await request('/itineraries/catalogue')
      assert.equal(catalogue.status, 200)
      assert.equal(catalogue.body.data.length, 72)
      const changed = await request(`/users/${owner.user.id}/preferences/${pref.id}`, owner.token, { locationPreferences: { destination: 'Kyoto', departureCity: 'Mumbai, India', fixed: false }, dayStart: '09:00', personalizationEnabled: false }, 'PATCH')
      assert.equal(changed.status, 200)
      const stored = await entities.find('preferences', pref.id)
      assert.equal((stored?.locationPreferences as { departureCity: string }).departureCity, 'Mumbai, India')
      assert.equal(stored?.dayStart, '09:00')
      assert.equal(stored?.personalizationEnabled, false)
    })
    await t.test('extraction persists a visible fallback without changing preferences', async () => {
      const response = await request('/companion', owner.token, { task: 'extract', roomId, message: 'Food and nature. No hiking. A relaxed pace.' })
      assert.equal(response.status, 200); assert.equal(response.body.source, 'fallback'); assert.ok(response.body.notice)
      suggestion = response.body.id
      assert.equal((await entities.find('preferences', pref.id))?.noGo, undefined)
      const history = await request(`/companion/history?roomId=${roomId}&task=extract`, owner.token)
      assert.equal(history.body.data[0].id, suggestion)
    })
    await t.test('explicit apply only updates selected fields on the author’s preferences', async () => {
      await upsertRow('trip_room_people', { trip_room_id: roomId, user_id: other.user.id, invite_status: 'accepted', role: 'member' }, ['trip_room_id', 'user_id'])
      assert.equal((await request(`/companion/${suggestion}/apply`, other.token, { fields: ['noGo'] })).status, 404)
      assert.equal((await request(`/companion/${suggestion}/apply`, owner.token, { fields: ['userId'] })).status, 400)
      assert.equal((await request(`/companion/${suggestion}/apply`, owner.token, { fields: ['noGo'] })).status, 200)
      assert.deepEqual((await request(`/companion/history?roomId=${roomId}&task=extract`, owner.token)).body.data[0].appliedFields, ['noGo'])
      const updated = await entities.find('preferences', pref.id)
      assert.equal(updated?.noGo, 'No hiking'); assert.equal(updated?.pace, undefined)
      assert.deepEqual(updated?.moodPreferences, ['Food & Culture'])
      assert.equal((await request(`/companion/${suggestion}/apply`, owner.token, { fields: ['noGo'] })).status, 200)
    })
    await t.test('stale suggestions cannot overwrite preferences changed since extraction', async () => {
      const reply = await request('/companion', owner.token, { task: 'extract', roomId, message: 'A relaxed pace' })
      await entities.update('preferences', pref.id, { pace: 'A balanced mix' })
      assert.equal((await request(`/companion/${reply.body.id}/apply`, owner.token, { fields: ['pace'] })).status, 409)
      assert.equal((await entities.find('preferences', pref.id))?.pace, 'A balanced mix')
      assert.equal(await entities.update('preferences', pref.id, { budget: 'Budget-friendly' }, { stale: true }), undefined)
    })
    await t.test('private conversation survives readback and stays separate from crew chat', async () => {
      await createQuestMessage(roomId, owner.user.id, 'Crew-only context')
      const reply = await request('/companion', owner.token, { task: 'chat', roomId, message: 'Help me compare our options.' })
      firstChat = reply.body.id
      assert.equal(reply.status, 200)
      assert.equal((await request(`/companion/history?roomId=${roomId}&task=chat`, owner.token)).body.data[0].id, firstChat)
      assert.deepEqual((await request(`/companion/history?roomId=${roomId}&task=chat`, other.token)).body.data, [])
      assert.equal((await selectRows('trip_room_messages', ['id'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }])).length, 1)
    })
    await t.test('personalisation validates a canonical trip and restores saved notes', async () => {
      await entities.create('preferences', 'pref_ai', { userId: other.user.id, tripRoomId: roomId, budget: 'Premium', daysCount: 6, moodPreferences: ['Food & Culture'], dates: { flexible: true }, pace: 'A balanced mix', submitted: true })
      assert.equal((await request('/itineraries/ai-generate', owner.token, { roomId })).status, 503)
      const plan = await recommendForQuest(roomId)
      const trip = plan.results[0]; assert.ok(trip)
      assert.equal((await request('/personalise-itinerary', owner.token, { roomId, itineraryId: 'fabricated', itinerary: { id: 'fabricated', dayPlan: [] } })).status, 409)
      const reply = await request('/personalise-itinerary', owner.token, { roomId, itineraryId: trip.id })
      assert.equal(reply.status, 200); assert.equal(reply.body.data.source, 'fallback')
      const saved = await request(`/personalise-itinerary?roomId=${roomId}&itineraryId=${trip.id}`, owner.token)
      assert.equal(saved.body.data.id, reply.body.data.id)
      const explanation = await request('/companion', owner.token, { task: 'explain', roomId, itineraryId: trip.id })
      assert.equal(explanation.status, 200); assert.ok(explanation.body.summary.includes(trip.destination))
      await entities.update('preferences', pref.id, { activitiesMustHave: 'A cooking class' })
      const fresh = await recommendForQuest(roomId)
      if (fresh.results.some(item => item.id === trip.id)) assert.equal((await request(`/personalise-itinerary?roomId=${roomId}&itineraryId=${trip.id}`, owner.token)).body.data, null)
      assert.deepEqual((await request(`/companion/history?roomId=${roomId}&task=explain`, owner.token)).body.data, [])
    })
    await t.test('valid provider responses receive private history and crew context only when selected', async () => {
      process.env.AI_PROVIDER = 'openai'; process.env.OPENAI_API_KEY = 'synthetic-no-network-key'
      const inputs: any[] = []
      t.mock.method(Responses.prototype, 'create', async (input: any) => { inputs.push(JSON.parse(input.input[1].content)); return { output_text: JSON.stringify({ summary: 'We can compare those options.' }) } })
      const reply = await request('/companion', owner.token, { task: 'chat', roomId, message: 'Which is quieter?' })
      assert.equal(reply.body.source, 'openai'); assert.ok(inputs[0].context.history.length); assert.equal(inputs[0].context.crew, undefined)
      await request('/companion', owner.token, { task: 'chat', roomId, message: 'Include our discussion.', includeCrew: true })
      assert.equal(inputs[1].context.crew[0].message, 'Crew-only context')
      process.env.OPENAI_API_KEY = ''
    })
    await t.test('draft summaries are stored separately from quest conversations', async () => {
      const reply = await request('/companion', owner.token, { task: 'group-dna', preferences: { budget: 'Moderate', tripFeeling: ['Nature'] } })
      assert.equal(reply.status, 200)
      const history = await request('/companion/history?task=group-dna', owner.token)
      assert.deepEqual(history.body.data.map((item: any) => item.id), [reply.body.id])
      assert.deepEqual(history.body.data[0].preferences, { budget: 'Moderate', tripFeeling: ['Nature'] })
    })
    await t.test('a successful story uses the canonical plan and is reused without another model call', async () => {
      process.env.AI_PROVIDER = 'ollama'; process.env.OLLAMA_API_KEY = 'synthetic-no-network-key'
      let calls = 0
      const trip = (await recommendForQuest(roomId)).results[0]; assert.ok(trip)
      t.mock.method(Responses.prototype, 'create', async (input: any) => {
        calls++
        const context = JSON.parse(input.input[1].content)
        assert.equal(context.trip.destination, trip.destination)
        return { output_text: JSON.stringify({ resultTitle: 'Our shared story', scrapbookIntro: 'Leave room for one another.', whyItWorks: ['Shared interests'], tradeoffNote: 'Discuss the pace.', days: context.trip.daily_plan.map((_: unknown, index: number) => ({ day: index + 1, note: 'Agree on a comfortable start.' })) }) }
      })
      const input = { roomId, itineraryId: trip.id, itinerary: { destination: 'Fake destination', dayPlan: [] } }
      const first = await request('/personalise-itinerary', owner.token, input)
      assert.equal(first.status, 200); assert.equal(first.body.data.source, 'ollama')
      const second = await request('/personalise-itinerary', owner.token, input)
      assert.equal(second.body.data.id, first.body.data.id); assert.equal(calls, 1)
      process.env.OLLAMA_API_KEY = ''
    })
    await t.test('simultaneous requests share a ten-per-minute quota across connections', async t => {
      const now = Date.now()
      t.mock.method(Date, 'now', () => now)
      const attempts = await Promise.allSettled(Array.from({ length: 14 }, () => reserveAiRequest(other.user.id, now)))
      assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 10)
      assert.equal(attempts.filter(item => item.status === 'rejected' && item.reason.status === 429).length, 4)
      assert.equal((await request('/companion', other.token, { task: 'chat', roomId, message: 'Too many requests' })).status, 429)
      await reserveAiRequest(other.user.id, now + 60000)
    })
  } finally {
    process.env.OPENAI_API_KEY = ''
    process.env.OLLAMA_API_KEY = ''
    if (originalProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = originalProvider
    await new Promise<void>(resolve => server.close(() => resolve()))
    if (roomId) await deleteRows('trip_rooms', [{ column: 'id', operator: 'eq', value: roomId }])
    for (const id of users) await deleteRows('users', [{ column: 'id', operator: 'eq', value: id }])
    await closeDatabase()
  }
})
