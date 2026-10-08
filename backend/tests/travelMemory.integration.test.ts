import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { Responses } from 'openai/resources/responses/responses'
import { app } from '../src/app.js'
import { registerUser } from '../src/services/authService.js'
import { createRoom } from '../src/services/roomService.js'
import { create } from '../src/services/apiStore.js'
import { respondToJourney } from '../src/services/questJourney.js'
import { recommendForQuest } from '../src/services/recommendationService.js'
import { closeDatabase, deleteRows, selectRows, updateRows, upsertRow } from '../src/storage.js'
import { getTravelProfile, travelAction, type TravelProfile } from '../src/services/travelMemory.js'
import type { PlanDocument } from '../src/services/workingPlan.js'

test(`travel memory, imports and credits (${process.env.DATABASE_PROVIDER})`, async t => {
  assert.equal(process.env.NODE_ENV, 'test')
  assert.equal(process.env.DATABASE_URL, 'postgres://provider_test:provider_test@127.0.0.1:55436/gotogether_provider_test')
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`
  const users: string[] = [], rooms: string[] = []
  const keys = ['AI_PROVIDER', 'OPENAI_API_KEY', 'OLLAMA_API_KEY']
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  let aiMode: 'valid' | 'invalid' | 'slow' = 'valid', modelCalls = 0
  t.mock.method(console, 'warn', () => {})
  t.mock.method(Responses.prototype, 'create', async (_input: any) => {
    modelCalls++
    const input = JSON.parse(_input.input[1].content)
    const item = input.plan.days.flatMap((day: any) => day.items).find((item: any) => !item.locked)
    if (aiMode === 'invalid') return { output_text: '{invalid' }
    if (aiMode === 'slow') await new Promise(resolve => setTimeout(resolve, 150))
    return { output_text: JSON.stringify({ summary: 'A quieter moment, reviewed before saving.', commands: [{ type: 'update', itemId: item.id, title: 'A quiet lunch together', kind: 'food', time: item.time, duration: 60, note: 'Check the location and opening hours.' }] }) }
  })
  const request = async (path: string, token?: string, body?: unknown, method = body ? 'POST' : 'GET') => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
    return { status: response.status, body: await response.json().catch(() => null) }
  }
  try {
    const owner = await registerUser({ firstName: 'Memory', lastName: 'Owner', email: `memory-${randomUUID()}@example.invalid`, password: 'Synthetic travel 2026!' }); users.push(owner.user.id)
    const guest = await registerUser({ firstName: 'Private', lastName: 'Traveller', email: `private-${randomUUID()}@example.invalid`, password: 'Synthetic travel 2026!' }); users.push(guest.user.id)
    const createQuest = async () => {
      const room = (await createRoom({ name: 'Learning fixture', tripName: 'Kyoto', ownerId: owner.user.id, members: 1 })).id; rooms.push(room)
      await create('preferences', 'memory_pref', { userId: owner.user.id, tripRoomId: room, budget: 'Flexible', daysCount: 6, locationPreferences: { destination: 'Kyoto', fixed: true }, companions: 'leisure', moodPreferences: ['Food & Culture'], dates: { flexible: true }, pace: 'A balanced mix', submitted: true })
      const recommendations = await recommendForQuest(room)
      const idea = recommendations.results[0]
      await respondToJourney(room, owner.user.id, { kind: 'option', optionId: idea.id, version: recommendations.preferenceVersion, reaction: 'works' })
      const plan = (await request(`/working-plans/${room}`, owner.token, { catalogueId: idea.id })).body.data
      return { room, plan }
    }
    const first = await createQuest()
    let plan: PlanDocument & { revision: number; learningPrompt?: { eventId: string } } = first.plan
    const path = `/working-plans/${first.room}`
    const change = (command: Record<string, unknown>, token = owner.token) => request(path + '/changes', token, { ...command, expectedRevision: plan.revision, requestId: randomUUID() })
    let eventId = ''
    await t.test('private profiles require auth and edits do not silently become memories', async () => {
      assert.equal((await request('/me/travel-style')).status, 401)
      const item = plan.days[0].items[0]
      const changed = await change({ ...item, type: 'update', itemId: item.id, time: '11:00' })
      assert.equal(changed.status, 200); plan = changed.body.data
      eventId = plan.learningPrompt!.eventId
      assert.equal((await getTravelProfile(owner.user.id)).memories.length, 0)
      assert.equal((await request('/me/travel-style/remember', guest.token, { eventId, context: 'leisure' })).status, 409)
    })
    await t.test('confirmed preferences affect a later matching trip, and undo reverses the evidence', async () => {
      const remembered = await request('/me/travel-style/remember', owner.token, { eventId, context: 'leisure' })
      assert.equal(remembered.status, 200)
      assert.equal(remembered.body.data.memories[0].value, '11:00')
      assert.equal((await createQuest()).plan.days[0].items[0].time, '11:00')
      plan = (await change({ type: 'undo' })).body.data
      assert.equal((await getTravelProfile(owner.user.id)).memories.length, 0)
      assert.equal((await createQuest()).plan.days[0].items[0].time, '10:00')
      assert.equal((await request('/me/travel-style/remember', owner.token, { eventId, context: 'leisure' })).status, 409)
    })
    await t.test('scopes, explicit corrections, pause, and trip overrides are respected', async () => {
      await request('/me/travel-style/memories', owner.token, { feature: 'day_start', value: '12:00', context: 'family' })
      assert.equal((await createQuest()).plan.days[0].items[0].time, '10:00')
      await request('/me/travel-style/memories', owner.token, { feature: 'day_start', value: '09:00', context: 'any' })
      assert.equal((await createQuest()).plan.days[0].items[0].time, '09:00')
      await request('/me/travel-style/settings', owner.token, { learningEnabled: false, useEnabled: false }, 'PATCH')
      const item = plan.days[0].items[0]
      plan = (await change({ ...item, type: 'update', itemId: item.id, time: '12:00' })).body.data
      assert.equal(plan.learningPrompt, null)
      assert.equal((await createQuest()).plan.days[0].items[0].time, '10:00')
      await request('/me/travel-style/settings', owner.token, { learningEnabled: true, useEnabled: true }, 'PATCH')
      assert.equal((await getTravelProfile(guest.user.id)).memories.length, 0)
      await request('/me/travel-style/memories', owner.token, undefined, 'DELETE')
    })
    let importId = ''
    const past = { title: 'Kyoto last spring', destination: 'Kyoto', endDate: '2025-04-06', context: 'leisure', days: [{ notes: 'Tea houses in the morning, a slow lunch, and a cooking class in the afternoon.' }], reflection: 'I loved the quiet mornings and would spend more time tasting local food.', loved: ['Food & Culture'], pace: '', dayStart: '', completed: true, mine: true, remember: true }
    await t.test('past trips require review; confirmation awards once and memories stay private', async () => {
      const draft = await request('/me/travel-style/imports', owner.token, { text: past.days[0].notes }); importId = draft.body.data.id
      assert.equal((await request(`/me/travel-style/imports/${importId}`, guest.token)).status, 404)
      const reviewed = { ...draft.body.data, destination: 'Kyoto', reflection: 'An unfinished review that survives a reload.' }
      assert.equal((await request(`/me/travel-style/imports/${importId}`, owner.token, reviewed, 'PATCH')).status, 200)
      assert.equal((await request(`/me/travel-style/imports/${importId}`, owner.token)).body.data.reflection, reviewed.reflection)
      assert.equal((await request(`/me/travel-style/imports/${importId}`, guest.token, reviewed, 'PATCH')).status, 409)
      assert.equal((await request(`/me/travel-style/imports/${importId}/confirm`, owner.token, { ...past, completed: false })).status, 400)
      assert.equal((await request(`/me/travel-style/imports/${importId}/confirm`, owner.token, { ...past, endDate: '2099-01-01' })).status, 400)
      const results = await Promise.all([request(`/me/travel-style/imports/${importId}/confirm`, owner.token, past), request(`/me/travel-style/imports/${importId}/confirm`, owner.token, past)])
      assert.deepEqual(results.map(result => result.status), [200, 200])
      const profile = await getTravelProfile(owner.user.id)
      assert.equal(profile.wallet.points, 100); assert.equal(profile.memories.length, 1)
      assert.equal((await getTravelProfile(guest.user.id)).imports.length, 0)
    })
    await t.test('redemptions cannot overspend or double-credit a retry', async () => {
      const key = randomUUID()
      const results = await Promise.all([request('/me/travel-style/redemptions', owner.token, { requestId: key }), request('/me/travel-style/redemptions', owner.token, { requestId: randomUUID() })])
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
      const success = results[0].status === 200 ? key : null
      if (success) assert.equal((await request('/me/travel-style/redemptions', owner.token, { requestId: success })).status, 200)
      const profile = await getTravelProfile(owner.user.id)
      assert.equal(profile.wallet.points, 0); assert.equal(profile.wallet.credits, 8)
    })
    await t.test('deleting a trip removes its learning and cannot mint another reward', async () => {
      await request(`/me/travel-style/imports/${importId}`, owner.token, undefined, 'DELETE')
      assert.equal((await getTravelProfile(owner.user.id)).memories.length, 0)
      const draft = await request('/me/travel-style/imports', owner.token, { text: past.days[0].notes })
      assert.equal((await request(`/me/travel-style/imports/${draft.body.data.id}/confirm`, owner.token, past)).status, 409)
    })
    await t.test('fallback previews cost nothing and only apply reviewed changes', async () => {
      delete process.env.AI_PROVIDER; delete process.env.OPENAI_API_KEY; delete process.env.OLLAMA_API_KEY
      const item = plan.days[0].items[0]
      plan = (await change({ type: 'lock', itemId: item.id })).body.data
      const before = await getTravelProfile(owner.user.id)
      const proposal = await request(path + '/proposals', owner.token, { instruction: 'Move unlocked moments one hour later', expectedRevision: plan.revision, dayId: plan.days[0].id, requestId: randomUUID() })
      assert.equal(proposal.status, 200); assert.equal(proposal.body.data.state, 'ready'); assert.equal(proposal.body.data.credit_charged, false)
      assert.equal((await getTravelProfile(owner.user.id)).wallet.credits, before.wallet.credits)
      assert.deepEqual((await request(path, owner.token)).body.data.days, plan.days)
      const saved = await change({ type: 'proposal', proposalId: proposal.body.data.id }); assert.equal(saved.status, 200); plan = saved.body.data
      assert.deepEqual(plan.days[0].items[0], { ...item, locked: true })
      assert.equal((await request(path + '/proposals', guest.token, { instruction: 'Change their plan', expectedRevision: plan.revision, requestId: randomUUID() })).status, 403)
    })
    await t.test('successful generation charges once; stale previews and invalid output are safe', async () => {
      process.env.AI_PROVIDER = 'openai'; process.env.OPENAI_API_KEY = 'synthetic-test-only'
      const input = { instruction: 'Make a quiet lunch', expectedRevision: plan.revision, requestId: randomUUID() }
      const before = (await getTravelProfile(owner.user.id)).wallet.credits
      const result = await request(path + '/proposals', owner.token, input)
      assert.equal(result.status, 200); assert.equal(result.body.data.credit_charged, true)
      const calls = modelCalls
      assert.equal((await request(path + '/proposals', owner.token, input)).body.data.id, result.body.data.id)
      assert.equal(modelCalls, calls)
      assert.equal((await getTravelProfile(owner.user.id)).wallet.credits, before - 1)
      plan = (await change({ type: 'rename', title: 'A different revision' })).body.data
      assert.equal((await change({ type: 'proposal', proposalId: result.body.data.id })).status, 409)
      aiMode = 'invalid'
      const failed = await request(path + '/proposals', owner.token, { ...input, expectedRevision: plan.revision, requestId: randomUUID() })
      assert.equal(failed.body.data.credit_charged, false)
      assert.equal((await getTravelProfile(owner.user.id)).wallet.credits, before - 1)
    })
    await t.test('parallel identical requests share one generation and expired reservations recover', async () => {
      aiMode = 'slow'
      const before = (await getTravelProfile(owner.user.id)).wallet.credits, calls = modelCalls
      const input = { instruction: 'A quieter lunch', expectedRevision: plan.revision, requestId: randomUUID() }
      const responses = await Promise.all([request(path + '/proposals', owner.token, input), request(path + '/proposals', owner.token, input)])
      assert.ok(responses.every(result => result.status === 200)); assert.equal(modelCalls, calls + 1)
      assert.equal((await getTravelProfile(owner.user.id)).wallet.credits, before - 1)
      const reserved = await travelAction<{ job: { id: string } }>(owner.user.id, 'reserve', { id: randomUUID(), roomId: first.room, requestId: randomUUID(), fingerprint: 'recovery-fixture', revision: plan.revision, data: {} })
      await updateRows('travel_ai_jobs', { expires_at: '2020-01-01T00:00:00Z' }, [{ column: 'id', operator: 'eq', value: reserved.job.id }], ['id'])
      assert.equal((await getTravelProfile(owner.user.id)).wallet.credits, before - 1)
      const late = await travelAction<{ job: { state: string } }>(owner.user.id, 'finish', { id: reserved.job.id, charge: true, data: { commands: [{ type: 'rename' }] } })
      assert.equal(late.job.state, 'failed')
      assert.equal((await getTravelProfile(owner.user.id)).wallet.credits, before - 1)
    })
    await t.test('changed preferences invalidate previews and known app drafts cannot earn history points', async () => {
      delete process.env.AI_PROVIDER; delete process.env.OPENAI_API_KEY
      const preview = await request(path + '/proposals', owner.token, { instruction: 'Move unlocked moments one hour later', expectedRevision: plan.revision, requestId: randomUUID() })
      assert.equal(preview.body.data.state, 'ready')
      await request('/me/travel-style/memories', owner.token, { feature: 'pace', value: 'Slow & relaxed', context: 'any' })
      assert.equal((await change({ type: 'proposal', proposalId: preview.body.data.id })).status, 409)
      const draft = await request('/me/travel-style/imports', owner.token, { text: 'A pasted plan needs a review before it can be saved.' })
      const result = await request(`/me/travel-style/imports/${draft.body.data.id}/confirm`, owner.token, { ...past, endDate: '2025-05-01', days: plan.days.map(day => ({ notes: day.items.map(item => item.title).join('; ') })), remember: false })
      assert.equal(result.status, 200); assert.equal(result.body.data.awardedPoints, 0)
    })
    await t.test('three monthly contributions cap rewards without blocking history saving', async () => {
      for (let i = 0; i < 3; i++) {
        const draft = await request('/me/travel-style/imports', owner.token, { text: past.days[0].notes })
        const result = await request(`/me/travel-style/imports/${draft.body.data.id}/confirm`, owner.token, { ...past, destination: `Test place ${i}`, days: [{ notes: past.days[0].notes + ` A distinct trip ${i} with a memorable stop.` }], remember: false })
        assert.equal(result.status, 200); assert.equal(result.body.data.awardedPoints, i < 2 ? 100 : 0)
      }
      assert.equal((await getTravelProfile(owner.user.id)).wallet.points, 200)
      await upsertRow('trip_room_people', { trip_room_id: first.room, user_id: guest.user.id, role: 'member', invite_status: 'accepted' }, ['trip_room_id', 'user_id'])
      const shared = await request(path, guest.token)
      assert.equal(shared.status, 200); assert.equal(shared.body.data.learningPrompt, undefined)
      assert.equal(JSON.stringify(shared.body).includes('memories'), false)
    })
    // An independent ledger sum proves holds/refunds/redemptions stay in balance.
    const profile: TravelProfile = await getTravelProfile(owner.user.id)
    const ledger = await selectRows<{ points_delta: number; credits_delta: number }>('travel_ledger', ['points_delta', 'credits_delta'], [{ column: 'user_id', operator: 'eq', value: owner.user.id }])
    assert.equal(ledger.reduce((sum, item) => sum + item.points_delta, 0), profile.wallet.points)
    assert.equal(ledger.reduce((sum, item) => sum + item.credits_delta, 0), profile.wallet.credits)
  } finally {
    for (const key of keys) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key] }
    for (const room of rooms) await deleteRows('trip_rooms', [{ column: 'id', operator: 'eq', value: room }])
    for (const user of users) await deleteRows('users', [{ column: 'id', operator: 'eq', value: user }])
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await closeDatabase()
  }
})
