import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { app } from '../src/app.js'
import { registerUser } from '../src/services/authService.js'
import { createRoom } from '../src/services/roomService.js'
import { respondToJourney } from '../src/services/questJourney.js'
import { recommendForQuest } from '../src/services/recommendationService.js'
import { create } from '../src/services/apiStore.js'
import { closeDatabase, deleteRows, upsertRow } from '../src/storage.js'

test(`working itinerary contract (${process.env.DATABASE_PROVIDER})`, async t => {
  assert.equal(process.env.NODE_ENV, 'test')
  assert.equal(process.env.DATABASE_URL, 'postgres://provider_test:provider_test@127.0.0.1:55436/gotogether_provider_test')
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`
  const users: string[] = []
  let room = ''
  const request = async (path: string, token?: string, body?: unknown, method = body ? 'POST' : 'GET') => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
    return { status: response.status, body: await response.json().catch(() => null) }
  }
  try {
    const owner = await registerUser({ firstName: 'Plan', lastName: 'Owner', email: `plan-${randomUUID()}@example.invalid`, password: 'Synthetic planning 2026!' }); users.push(owner.user.id)
    const member = await registerUser({ firstName: 'Plan', lastName: 'Member', email: `plan-${randomUUID()}@example.invalid`, password: 'Synthetic planning 2026!' }); users.push(member.user.id)
    room = (await createRoom({ name: 'Working plan fixture', tripName: 'Kyoto', ownerId: owner.user.id, members: 1 })).id
    await create('preferences', 'pref_plan', { userId: owner.user.id, tripRoomId: room, budget: 'Flexible', daysCount: 4, moodPreferences: ['Food & Culture'], dates: { flexible: true }, pace: 'A balanced mix', submitted: true })
    const recommendations = await recommendForQuest(room)
    const trip = recommendations.results[0]
    await respondToJourney(room, owner.user.id, { kind: 'option', optionId: trip.id, version: recommendations.preferenceVersion, reaction: 'works' })
    let plan: any
    const path = `/working-plans/${room}`
    const change = (command: Record<string, unknown>, revision = plan.revision, requestId = randomUUID()) => request(path + '/changes', owner.token, { ...command, expectedRevision: revision, requestId })
    await t.test('account, room and plan access cannot be forged', async () => {
      assert.equal((await request(path)).status, 401)
      assert.equal((await request(path, member.token)).status, 403)
      assert.equal((await request(path + '/confirmations', member.token)).status, 403)
      assert.equal((await request(path + '/area-ideas?destination=Kyoto', member.token)).status, 403)
      assert.equal((await request(`/users/${owner.user.id}`, member.token, undefined, 'DELETE')).status, 403)
      assert.equal((await request(`/trip-rooms/${room}`, member.token, { ownerId: member.user.id }, 'PATCH')).status, 403)
      assert.equal((await request('/trip-rooms', undefined, { name: 'Forged', tripName: 'Forged', ownerId: owner.user.id })).status, 401)
    })
    await t.test('legacy suggestion writes cannot change planning records or another user’s suggestions', async () => {
      const ownPath = `/users/${owner.user.id}/suggested-itineraries`
      const created = await request(ownPath, owner.token, { title: 'My manual idea', userId: member.user.id })
      assert.equal(created.status, 201); assert.equal(created.body.data.userId, owner.user.id)
      const id = created.body.data.id
      assert.equal((await request(`/users/${member.user.id}/suggested-itineraries/${id}`, member.token, { title: 'Hijacked' }, 'PATCH')).status, 404)
      assert.equal((await request(`${ownPath}/${id}`, owner.token, { title: 'Updated manual idea' }, 'PATCH')).status, 200)
      for (const protectedId of [`aiq_v3_${room}_version`, 'confirm2-scoped-record', 'ideas3-scoped-record']) {
        assert.equal((await request(`${ownPath}/${protectedId}`, owner.token, { results: [], confirmed: true }, 'PATCH')).status, 403)
      }
    })
    await t.test('creation uses a current canonical recommendation and is idempotent', async () => {
      assert.equal((await request(path, owner.token, { catalogueId: 'fabricated' })).status, 409)
      const result = await request(path, owner.token, { catalogueId: trip.id })
      assert.equal(result.status, 201); plan = result.body.data
      assert.equal(plan.revision, 1); assert.equal(plan.destination, trip.destination)
      assert.deepEqual((await request(path, owner.token, { catalogueId: trip.id })).body.data, plan)
    })
    await t.test('members can read but only the host can edit', async () => {
      await upsertRow('trip_room_people', { trip_room_id: room, user_id: member.user.id, invite_status: 'accepted', role: 'member' }, ['trip_room_id', 'user_id'])
      assert.equal((await request(path, member.token)).status, 200)
      assert.equal((await request(path + '/changes', member.token, { type: 'rename', title: 'Hijacked', expectedRevision: 1, requestId: randomUUID() })).status, 403)
    })
    await t.test('activity confirmations survive concurrent cards but expire after an edit', async () => {
      const initial = await request(path + '/confirmations', member.token)
      assert.equal(initial.status, 200)
      const [first, second] = plan.days[0].items
      const confirm = (itemId: string, itemVersion: string, confirmed = true) => request(path + '/confirmations', member.token, { itemId, itemVersion, confirmed })
      const results = await Promise.all([confirm(first.id, initial.body.data.versions[first.id]), confirm(second.id, initial.body.data.versions[second.id])])
      assert.deepEqual(results.map(result => result.status), [200, 200])
      let state = (await request(path + '/confirmations', owner.token)).body.data
      assert.equal(state.confirmations[first.id].length, 1); assert.equal(state.confirmations[second.id].length, 1)
      assert.equal((await confirm('missing-activity', 'anything')).status, 404)
      assert.equal((await confirm(first.id, 'stale-version')).status, 409)
      const edited = await change({ type: 'update', ...first, title: 'A revised morning', itemId: first.id })
      assert.equal(edited.status, 200); plan = edited.body.data
      state = (await request(path + '/confirmations', owner.token)).body.data
      assert.equal(state.confirmations[first.id], undefined); assert.equal(state.confirmations[second.id].length, 1)
      assert.equal((await confirm(first.id, initial.body.data.versions[first.id])).status, 409)
      assert.equal((await confirm(first.id, state.versions[first.id])).status, 200)
      assert.equal((await confirm(second.id, state.versions[second.id], false)).status, 200)
      assert.equal((await request(path + '/confirmations', owner.token)).body.data.confirmations[second.id], undefined)
      plan = (await change({ type: 'undo' })).body.data
    })
    await t.test('move, readback, retry, and undo preserve the exact activity', async () => {
      const item = plan.days[0].items[0]
      const before = structuredClone(plan.days)
      const command = { type: 'move', itemId: item.id, dayId: plan.days[1].id, index: 0 }
      const key = randomUUID()
      const revision = plan.revision
      const moved = await change(command, revision, key); assert.equal(moved.status, 200); plan = moved.body.data
      assert.deepEqual(plan.days[1].items[0], item)
      assert.equal((await change(command, revision, key)).body.data.revision, revision + 1)
      assert.equal((await change(command, revision)).status, 409)
      assert.deepEqual((await request(path, owner.token)).body.data.days, plan.days)
      const undo = await change({ type: 'undo' }); assert.equal(undo.status, 200); plan = undo.body.data
      assert.deepEqual(plan.days, before)
    })
    await t.test('locks and validation are enforced server-side', async () => {
      const itemId = plan.days[0].items[0].id
      plan = (await change({ type: 'lock', itemId })).body.data
      assert.equal((await change({ type: 'remove', itemId })).status, 409)
      assert.equal((await change({ type: 'switch', catalogueId: trip.id })).status, 409)
      assert.equal((await change({ type: 'move', itemId, dayId: plan.days[1].id, index: 0 })).status, 409)
      assert.equal((await change({ type: 'add', dayId: plan.days[0].id, title: 'Invalid', kind: 'food', time: '99:99', duration: -1 })).status, 400)
      assert.equal((await change({ type: 'overwrite', days: [] })).status, 404)
    })
    await t.test('concurrent changes cannot overwrite each other', async () => {
      const results = await Promise.all([change({ type: 'rename', title: 'First name' }), change({ type: 'rename', title: 'Second name' })])
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
      const saved = (await request(path, owner.token)).body.data
      assert.equal(saved.revision, plan.revision + 1)
      assert.ok(['First name', 'Second name'].includes(saved.title))
    })
  } finally {
    if (room) await deleteRows('trip_rooms', [{ column: 'id', operator: 'eq', value: room }])
    for (const user of users) await deleteRows('users', [{ column: 'id', operator: 'eq', value: user }])
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await closeDatabase()
  }
})
