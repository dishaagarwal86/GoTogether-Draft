import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { app } from '../src/app.js'
import { registerUser } from '../src/services/authService.js'
import { createRoom } from '../src/services/roomService.js'
import { create } from '../src/services/apiStore.js'
import { closeDatabase, deleteRows, insertRow, selectRows } from '../src/storage.js'

test(`solo travel contract (${process.env.DATABASE_PROVIDER})`, async t => {
  assert.equal(process.env.NODE_ENV, 'test')
  assert.equal(process.env.DATABASE_URL, 'postgres://provider_test:provider_test@127.0.0.1:55436/gotogether_provider_test')
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`
  const users: string[] = [], rooms: string[] = []
  const request = async (path: string, token: string, body?: unknown) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, body: await response.json() }
  }
  const account = async (name: string) => { const value = await registerUser({ firstName: name, lastName: 'Traveller', email: `${name}-${randomUUID()}@example.invalid`, password: 'Synthetic solo journey 2026!' }); users.push(value.user.id); return value }
  const preferences = { submitted: true, dates: { flexible: true }, daysCount: 4, budget: 'Flexible', moodPreferences: ['Nature', 'Food & Culture'], pace: 'A balanced mix', companions: 'friends' }
  try {
    const host = await account('SoloHost'), member = await account('Friend')
    const room = (await createRoom({ name: 'A flexible chapter', tripName: 'Anywhere', members: 3, ownerId: host.user.id })).id; rooms.push(room)
    const path = `/trip-rooms/${room}`
    const mode = (value: string, requestId = randomUUID(), token = host.token) => request(path + '/travel-mode', token, { mode: value, requestId })
    const read = async (id = room) => (await request(`/trip-rooms/${id}/journey`, host.token)).body.data
    let plan: any, soloRoom = '', link = ''
    await t.test('only the host can change mode, with explicit valid input', async () => {
      assert.equal((await mode('solo', randomUUID(), member.token)).status, 403)
      assert.equal((await mode('anything')).status, 400)
      assert.equal((await mode('solo', 'bad-id')).status, 400)
    })
    await t.test('an empty group becomes solo in place, revokes its old link and still needs own preferences', async () => {
      link = (await request(path + '/join-link', host.token, {})).body.data.url.split('/').at(-1)
      assert.equal((await read()).ready, false)
      const response = await mode('solo'); assert.equal(response.status, 200); assert.deepEqual(response.body.data, { roomId: room, copied: false, mode: 'solo' })
      const state = await read(); assert.equal(state.totalMembers, 1); assert.equal(state.ready, false)
      assert.equal((await request(`/join-room/${link}`, member.token, {})).status, 404)
      assert.equal((await request(`/working-plans/${room}`, host.token, { catalogueId: 'anything' })).status, 409)
    })
    await t.test('solo travellers choose directly without responding to themselves and can mark the plan ready', async () => {
      await create('preferences', 'pref', { ...preferences, companions: 'solo', peopleCount: 1, userId: host.user.id, tripRoomId: room })
      let state = await read(); assert.equal(state.ready, true); assert.equal(state.results[0].label, 'Best for you'); assert.equal(state.options[state.results[0].id].answered, 0)
      const response = await request(`/working-plans/${room}`, host.token, { catalogueId: state.results[0].id }); assert.equal(response.status, 201); plan = response.body.data
      state = await read()
      assert.equal((await request(path + '/responses', host.token, { kind: 'plan', version: state.planReview.version, reaction: 'works' })).status, 200)
      assert.equal((await read()).planReview.status, 'agreed')
      const changed = await request(`/working-plans/${room}/changes`, host.token, { type: 'lock', itemId: plan.days[0].items[0].id, expectedRevision: plan.revision, requestId: randomUUID() })
      assert.equal(changed.status, 200); plan = changed.body.data
      assert.equal((await read()).planReview.status, 'review')
    })
    await t.test('switching to group keeps edits and undo, but waits for the added traveller', async () => {
      await insertRow('preferences', { id: 'pref_' + randomUUID(), trip_room_id: room, user_id: host.user.id, data: { submitted: false, companions: 'friends' }, updated_at: '2000-01-01T00:00:00Z' }, ['id'])
      const response = await mode('group'); assert.equal(response.status, 200); assert.equal(response.body.data.roomId, room)
      const state = await read(); assert.equal(state.totalMembers, 2); assert.equal(state.ready, false)
      assert.deepEqual((await request(`/working-plans/${room}`, host.token)).body.data.days, plan.days)
      assert.equal((await request(`/working-plans/${room}`, host.token)).body.data.canUndo, true)
      assert.equal((await request(path + '/responses', host.token, { kind: 'plan', version: state.planReview.version, reaction: 'works' })).status, 409)
      const prefs = await selectRows<any>('preferences', ['data'], [{ column: 'trip_room_id', operator: 'eq', value: room }], { orderBy: 'updated_at' }); assert.equal(prefs[0].data.companions, 'friends')
    })
    await t.test('returning to solo in place preserves the exact plan and undo history', async () => {
      const response = await mode('solo'); assert.equal(response.status, 200); assert.equal(response.body.data.copied, false)
      assert.equal((await read()).ready, true, 'A mode change must not revive an older preference draft')
      const saved = (await request(`/working-plans/${room}`, host.token)).body.data
      assert.deepEqual(saved.days, plan.days); assert.equal(saved.revision, plan.revision); assert.equal(saved.canUndo, true)
      await mode('group')
      link = (await request(path + '/join-link', host.token, {})).body.data.url.split('/').at(-1)
      assert.equal((await request(`/join-room/${link}`, member.token, {})).status, 200)
      await create('preferences', 'pref', { ...preferences, userId: member.user.id, tripRoomId: room })
      assert.equal((await mode('solo', randomUUID(), member.token)).status, 403)
      await request(path + '/messages', member.token, { body: 'A shared conversation that stays here.' })
      for (const [user, title] of [[host.user.id, 'My own idea'], [member.user.id, 'Their private idea']]) await insertRow('quest_picks', { id: randomUUID(), trip_room_id: room, user_id: user, type: 'activity', title }, ['id'])
    })
    await t.test('a joined room makes an independent solo copy, keeps locks, and copies only personal data', async () => {
      const requestId = randomUUID()
      const [first, retry] = await Promise.all([mode('solo', requestId), mode('solo', requestId)])
      assert.equal(first.status, 200); assert.deepEqual(first.body, retry.body)
      soloRoom = first.body.data.roomId; rooms.push(soloRoom); assert.notEqual(soloRoom, room); assert.equal(first.body.data.copied, true)
      assert.equal((await mode('group', requestId)).status, 409, 'A receipt cannot be reused for another mode')
      const copy = (await request(`/working-plans/${soloRoom}`, host.token)).body.data
      assert.deepEqual(copy.days, plan.days); assert.equal(copy.canUndo, false); assert.equal(copy.revision, 1)
      assert.equal(copy.days[0].items[0].locked, true)
      const state = await read(soloRoom); assert.equal(state.totalMembers, 1); assert.equal(state.memberCount, 1); assert.equal(state.planReview.answered, 0)
      const picks = await selectRows<any>('quest_picks', ['title', 'shared_at'], [{ column: 'trip_room_id', operator: 'eq', value: soloRoom }]); assert.equal(picks.length, 1); assert.equal(picks[0].title, 'My own idea'); assert.equal(picks[0].shared_at, null)
      assert.equal((await request(`/trip-rooms/${soloRoom}/messages`, host.token)).body.data.length, 0)
      assert.equal((await request(`/working-plans/${soloRoom}`, member.token)).status, 403)
      assert.equal((await request(`/trip-rooms/${soloRoom}/journey`, member.token)).status, 403)
      assert.equal((await read()).totalMembers, 2); assert.equal((await request(`/working-plans/${room}`, member.token)).status, 200)
      assert.equal((await request(path + '/messages', member.token)).body.data.length, 1)
      const changed = await request(`/working-plans/${soloRoom}/changes`, host.token, { type: 'rename', title: 'Only my version changes', expectedRevision: 1, requestId: randomUUID() }); assert.equal(changed.status, 200)
      assert.equal((await request(`/working-plans/${room}`, host.token)).body.data.title, plan.title)
    })
    await t.test('pending email guests also cause a copy and keep their invitation usable', async () => {
      const invitation = await request(`/trip-rooms/${soloRoom}/invites`, host.token, { email: `pending-${randomUUID()}@example.invalid` }); assert.equal(invitation.status, 201)
      const token = invitation.body.data.inviteUrl.split('/').at(-1)
      const copied = await request(`/trip-rooms/${soloRoom}/travel-mode`, host.token, { mode: 'solo', requestId: randomUUID() }); assert.equal(copied.status, 200); assert.equal(copied.body.data.copied, true); rooms.push(copied.body.data.roomId)
      assert.equal((await request(`/invites/${token}`, host.token)).status, 200)
      assert.equal((await read(copied.body.data.roomId)).totalMembers, 1)
    })
  } finally {
    for (const room of rooms.reverse()) await deleteRows('trip_rooms', [{ column: 'id', operator: 'eq', value: room }])
    for (const id of users) await deleteRows('users', [{ column: 'id', operator: 'eq', value: id }])
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await closeDatabase()
  }
})
