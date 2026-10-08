import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { Responses } from 'openai/resources/responses/responses'
import { registerUser } from '../src/services/authService.js'
import { createRoom } from '../src/services/roomService.js'
import { create, update } from '../src/services/apiStore.js'
import { recommendForQuest, publicRecommendations } from '../src/services/recommendationService.js'
import { respondToJourney } from '../src/services/questJourney.js'
import { startWorkingPlan, changeWorkingPlan } from '../src/services/workingPlan.js'
import { closeDatabase, deleteRows, upsertRow } from '../src/storage.js'

test(`generated itinerary integration (${process.env.DATABASE_PROVIDER})`, async t => {
  assert.equal(process.env.NODE_ENV, 'test')
  assert.equal(process.env.DATABASE_URL, 'postgres://provider_test:provider_test@127.0.0.1:55436/gotogether_provider_test')
  const saved = { provider: process.env.AI_PROVIDER, key: process.env.OPENAI_API_KEY }
  let release!: () => void
  const barrier = new Promise<void>(resolve => { release = resolve })
  let calls = 0
  const users: string[] = []
  let room = ''
  t.mock.method(Responses.prototype, 'create', async function (this: any, request: any, options: any) {
    calls++
    assert.equal(this._client.maxRetries, 0)
    assert.ok(this._client.timeout <= 45_000)
    assert.ok(options.signal instanceof AbortSignal)
    assert.equal(request.input[1].role, 'user')
    assert.match(request.input[1].content, /REFERENCE PLACES:/)
    assert.match(request.input[1].content, /kyoto-kiyomizu-dera/)
    await barrier
    return { output_text: JSON.stringify({ destination: 'Kyoto', country: 'Japan', currency: 'USD', title: 'Markets and museums', location_type: 'City', budget: 'Moderate', estimated_total_per_person: 800, moods: ['Food & Culture'], seasons: ['Autumn'], travel_dates: { start: '2026-11-05', end: '2026-11-08' }, days: Array.from({ length: 4 }, () => ({ morning: { activity: 'Market breakfast' }, afternoon: { activity: 'Kiyomizu-dera Temple', place_id: 'kyoto-kiyomizu-dera' }, evening: { activity: 'A neighbourhood dinner' } })), stays: [{ name: 'Hyatt Regency Kyoto', place_id: 'kyoto-hyatt-regency', price_per_night: 100 }] }) }
  })
  try {
    process.env.AI_PROVIDER = 'openai'; process.env.OPENAI_API_KEY = 'synthetic-key'
    const owner = await registerUser({ firstName: 'Host', lastName: 'Test', email: `ai-plan-${randomUUID()}@example.invalid`, password: 'Synthetic itinerary 2026!' }); users.push(owner.user.id)
    const member = await registerUser({ firstName: 'Member', lastName: 'Test', email: `ai-plan-${randomUUID()}@example.invalid`, password: 'Synthetic itinerary 2026!' }); users.push(member.user.id)
    room = (await createRoom({ name: 'Generated group trip', tripName: 'Japan', members: 2, ownerId: owner.user.id })).id
    const preferences = { submitted: true, dates: { start: '2026-11-05', end: '2026-11-10', flexible: false }, daysCount: 4, budget: 'Moderate', moodPreferences: ['Food & Culture'], pace: 'A balanced mix', locationPreferences: { destination: 'Japan', fixed: true } }
    const hostPref = await create('preferences', 'ai_pref', { ...preferences, userId: owner.user.id, tripRoomId: room })
    await t.test('incomplete groups do not trigger AI or expose single-person recommendations', async () => {
      const result = await recommendForQuest(room)
      assert.equal(result.ready, false); assert.equal(calls, 0); assert.deepEqual(result.allResults, [])
      assert.equal(result.generationStatus, 'waiting')
    })
    await upsertRow('trip_room_people', { trip_room_id: room, user_id: member.user.id, role: 'member', invite_status: 'accepted' }, ['trip_room_id', 'user_id'])
    await create('preferences', 'ai_pref', { ...preferences, userId: member.user.id, tripRoomId: room })
    await t.test('room reads return while generation is pending and deduplicate requests', async () => {
      const result = await Promise.race([recommendForQuest(room), new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error('Room request blocked on AI')), 3000); timer.unref() })])
      assert.equal(result.ready, true); assert.equal(result.generationPending, true); assert.ok(result.allResults.length)
      assert.equal(result.generationStatus, 'generating')
      await recommendForQuest(room)
      assert.equal(calls, 3)
    })
    release()
    let result = await recommendForQuest(room)
    for (let attempt = 0; result.generationPending && attempt < 40; attempt++) { await new Promise(resolve => setTimeout(resolve, 50)); result = await recommendForQuest(room) }
    await t.test('cached generated options retain shared filters, scoring and privacy', async () => {
      assert.equal(result.generationPending, false)
      assert.equal(result.generationStatus, 'ready')
      const generated = result.allResults.filter(trip => trip.source === 'ai')
      assert.equal(generated.length, 3)
      assert.equal(calls, 3)
      assert.ok(generated.every(trip => trip.country === 'Japan' && trip.duration_days === 4 && trip.score >= 0 && trip.score <= 100 && trip.currency === 'USD'))
      const publicResult = publicRecommendations(result, owner.user.id)
      assert.deepEqual(publicResult.travelDna?.noGoActivities, [])
      assert.ok(publicResult.allResults.every(trip => !('memberFits' in trip) && !('minFit' in trip)))
    })
    const trip = result.allResults.find(trip => trip.source === 'ai')!
    await t.test('AI options require group agreement and save booking details in the working plan', async () => {
      await assert.rejects(startWorkingPlan(room, owner.user.id, trip.id), /Everyone needs to respond/)
      for (const person of users) await respondToJourney(room, person, { kind: 'option', optionId: trip.id, reaction: 'works', version: result.preferenceVersion })
      let plan = (await startWorkingPlan(room, owner.user.id, trip.id))!
      assert.equal(plan.bookings?.currency, 'USD'); assert.equal(plan.days.length, 4)
      assert.equal(plan.days[0].items[0].title, 'Market breakfast')
      assert.equal(plan.days[0].items[1].placeSource?.placeId, 'kyoto-kiyomizu-dera')
      assert.equal((plan.bookings?.stays?.[0] as any).placeSource?.placeId, 'kyoto-hyatt-regency')
      const alternative = result.allResults.find(value => value.id !== trip.id)!
      await assert.rejects(changeWorkingPlan(room, owner.user.id, { type: 'switch', catalogueId: alternative.id, expectedRevision: plan.revision, requestId: randomUUID() }), /Everyone needs to respond/)
      plan = await changeWorkingPlan(room, owner.user.id, { type: 'lock', itemId: plan.days[0].items[0].id, expectedRevision: plan.revision, requestId: randomUUID() })
      await assert.rejects(changeWorkingPlan(room, owner.user.id, { type: 'switch', catalogueId: trip.id, expectedRevision: plan.revision, requestId: randomUUID() }), /locked activities/)
    })
    process.env.OPENAI_API_KEY = ''
    await t.test('changed preferences cannot reuse generated options from an older version', async () => {
      await update('preferences', hostPref.id, { noGo: 'no museums' })
      const updated = await recommendForQuest(room)
      assert.notEqual(updated.preferenceVersion, result.preferenceVersion)
      assert.equal(updated.allResults.some(value => value.id === trip.id), false)
      assert.equal(updated.generationPending, false)
      assert.equal(updated.generationStatus, 'unconfigured')
    })
  } finally {
    release()
    if (saved.provider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = saved.provider
    if (saved.key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = saved.key
    if (room) await deleteRows('trip_rooms', [{ column: 'id', operator: 'eq', value: room }])
    for (const user of users) await deleteRows('users', [{ column: 'id', operator: 'eq', value: user }])
    await closeDatabase()
  }
})
