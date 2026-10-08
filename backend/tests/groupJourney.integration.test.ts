import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { app } from '../src/app.js'
import { registerUser } from '../src/services/authService.js'
import { createRoom } from '../src/services/roomService.js'
import { create, update } from '../src/services/apiStore.js'
import { closeDatabase, deleteRows } from '../src/storage.js'

test(`group journey contract (${process.env.DATABASE_PROVIDER})`, async t => {
  assert.equal(process.env.NODE_ENV, 'test')
  assert.equal(process.env.DATABASE_URL, 'postgres://provider_test:provider_test@127.0.0.1:55436/gotogether_provider_test')
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`
  const users: string[] = []
  let room = ''
  const request = async (path: string, token?: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, body: await response.json() }
  }
  const account = async (name: string) => { const value = await registerUser({ firstName: name, lastName: 'Traveller', email: `${name}-${randomUUID()}@example.invalid`, password: 'Synthetic group journey 2026!' }); users.push(value.user.id); return value }
  const preferences = { submitted: true, dates: { flexible: true }, daysCount: 4, budget: 'Flexible', moodPreferences: ['Nature', 'Food & Culture'], pace: 'A balanced mix', noGo: '' }
  try {
    const host = await account('Host'), member = await account('Member'), outsider = await account('Other')
    room = (await createRoom({ name: 'Our shared chapter', tripName: 'Anywhere', members: 2, ownerId: host.user.id })).id
    const path = `/trip-rooms/${room}`
    const journey = async () => (await request(path + '/journey', host.token)).body.data
    const hostPref = await create('preferences', 'pref', { ...preferences, userId: host.user.id, tripRoomId: room })
    let link = '', memberPref = '', option = '', version = '', plan: any
    const vote = (token: string, reaction: string, optionId = option, context = version) => request(path + '/responses', token, { kind: 'option', optionId, version: context, reaction })
    await t.test('an incomplete group can chat but cannot get matches or bypass plan creation', async () => {
      const state = await journey()
      assert.equal(state.totalMembers, 2); assert.equal(state.memberCount, 1); assert.equal(state.ready, false); assert.deepEqual(state.allResults, [])
      assert.equal((await request(path + '/messages', host.token, { body: 'What would everyone love to do?' })).status, 201)
      assert.equal((await request(`/working-plans/${room}`, host.token, { catalogueId: 'anything' })).status, 409)
      assert.equal((await request('/itineraries/ai-generate', host.token, { roomId: room })).status, 409)
      assert.equal((await request(path + '/journey', outsider.token)).status, 403)
      assert.equal((await request(path + '/join-link', outsider.token, {})).status, 403)
    })
    await t.test('share links survive readback, authenticate joining, and preserve the host role', async () => {
      link = (await request(path + '/join-link', host.token, {})).body.data.url.split('/').at(-1)
      assert.ok(link)
      assert.ok((await request(path + '/join-link', host.token, {})).body.data.url.endsWith(link))
      assert.equal((await request(`/join-room/${link}`)).body.data.name, 'Our shared chapter')
      assert.equal((await request(`/join-room/${link}`, undefined, {})).status, 401)
      assert.equal((await request(`/join-room/${link}`, host.token, {})).status, 200)
      assert.equal((await request(`/join-room/${link}`, member.token, {})).status, 200)
      memberPref = (await create('preferences', 'pref', { ...preferences, submitted: false, userId: member.user.id, tripRoomId: room })).id
      assert.equal((await journey()).ready, false, 'An unconfirmed draft cannot count as ready')
      await update('preferences', memberPref, { submitted: true })
      const state = await journey(); assert.equal(state.ready, true); assert.equal(state.totalMembers, 2)
      assert.ok(state.allResults.length > state.results.length); assert.equal(state.results[2].label, 'Alternative experience')
      assert.ok(state.allResults.every((trip: any) => !('memberFits' in trip) && typeof trip.personalFit === 'number'))
      option = state.allResults[3].id; version = state.preferenceVersion
      assert.equal((await request(path + '/crew', member.token, { action: 'resize', members: 1 })).status, 403)
      assert.equal((await request(path + '/crew', host.token, { action: 'resize', members: 1 })).status, 400)
    })
    await t.test('concerns and missing responses prevent selection; changed preferences invalidate old votes', async () => {
      assert.equal((await vote(host.token, 'love')).status, 200)
      assert.equal((await request(`/working-plans/${room}`, host.token, { catalogueId: option })).status, 409)
      await vote(member.token, 'concern')
      assert.equal((await journey()).options[option].concerns, 1)
      assert.equal((await request(`/working-plans/${room}`, host.token, { catalogueId: option })).status, 409)
      await update('preferences', memberPref, { pace: 'Slow & relaxed' })
      assert.equal((await vote(member.token, 'works')).status, 409)
      const state = await journey(); version = state.preferenceVersion; option = state.allResults[3].id
      assert.equal(state.options[option].answered, 0)
      await vote(host.token, 'love'); await vote(member.token, 'works')
      assert.equal((await journey()).options[option].agreed, true)
      const saved = await request(`/working-plans/${room}`, host.token, { catalogueId: option })
      assert.equal(saved.status, 201); plan = saved.body.data; assert.equal(plan.catalogueId, option)
    })
    await t.test('plan agreement is persisted per revision and cannot be reused after editing', async () => {
      let state = await journey()
      for (const token of [host.token, member.token]) assert.equal((await request(path + '/responses', token, { kind: 'plan', version: state.planReview.version, reaction: 'works' })).status, 200)
      assert.equal((await journey()).planReview.status, 'agreed')
      const changed = await request(`/working-plans/${room}/changes`, host.token, { type: 'rename', title: 'A revised shared chapter', expectedRevision: plan.revision, requestId: randomUUID() })
      assert.equal(changed.status, 200); plan = changed.body.data
      assert.equal((await request(path + '/responses', member.token, { kind: 'plan', version: state.planReview.version, reaction: 'works' })).status, 409)
      state = await journey(); assert.equal(state.planReview.status, 'review'); assert.equal(state.planReview.answered, 0)
      assert.equal((await request(`/working-plans/${room}/changes`, member.token, { type: 'rename', title: 'Unauthorized', expectedRevision: plan.revision, requestId: randomUUID() })).status, 403)
    })
    await t.test('non-overlapping dates block group options while preserving the saved plan', async () => {
      await update('preferences', hostPref.id, { dates: { start: '2027-02-01', end: '2027-02-06', flexible: false } })
      await update('preferences', memberPref, { dates: { start: '2027-03-01', end: '2027-03-06', flexible: false } })
      const state = await journey(); assert.equal(state.availability.conflict, true); assert.deepEqual(state.allResults, []); assert.equal(state.planReview.canConfirm, false)
      assert.equal((await request(`/working-plans/${room}`, host.token)).body.data.title, plan.title)
      assert.equal((await request(`/users/${host.user.id}/preferences/${hostPref.id}`, host.token, { dates: { start: '2027-02-30', end: '2027-03-06', flexible: false } }, 'PATCH')).status, 400)
      await update('preferences', hostPref.id, { dates: { flexible: true } }); await update('preferences', memberPref, { dates: { flexible: true } })
    })
    await t.test('pending guests are counted and complete guest answers participate before account creation', async () => {
      const invitation = await request(path + '/invites', host.token, { email: `new-guest-${randomUUID()}@example.invalid` })
      assert.equal(invitation.status, 201)
      const token = invitation.body.data.inviteUrl.split('/').at(-1), guestSessionId = randomUUID()
      assert.equal((await journey()).totalMembers, 3); assert.equal((await journey()).ready, false)
      assert.equal((await request(`/invites/${token}/guest-preferences`, undefined, { guestSessionId, answers: { budget: 'Flexible' } })).status, 400)
      assert.equal((await request(`/invites/${token}/guest-preferences`, undefined, { guestSessionId, answers: { ...preferences, displayName: 'Guest voice' } })).status, 201)
      let state = await journey(); assert.equal(state.ready, true); assert.equal(state.memberCount, 3)
      const guestView = await request(`/invites/${token}/journey`, undefined, { guestSessionId }); assert.equal(guestView.status, 200)
      assert.equal((await request(`/invites/${token}/journey`, undefined, { guestSessionId: randomUUID() })).status, 403)
      const guestOption = state.results[0].id
      assert.equal((await request(`/invites/${token}/response`, undefined, { guestSessionId, response: { kind: 'option', optionId: guestOption, version: state.preferenceVersion, reaction: 'works' } })).status, 200)
      assert.equal((await journey()).options[guestOption].answered, 1)
      const guest = state.participants.find((person: any) => person.role === 'guest')
      assert.equal((await request(path + '/crew', host.token, { action: 'remove', participantId: guest.id })).status, 200)
      assert.equal((await request(`/invites/${token}/journey`, undefined, { guestSessionId })).status, 404)
      state = await journey(); assert.equal(state.totalMembers, 2); assert.equal(state.memberCount, 2)
    })
    await t.test('replacing a shared link revokes the old capability', async () => {
      const fresh = (await request(path + '/join-link', host.token, { rotate: true })).body.data.url.split('/').at(-1)
      assert.notEqual(fresh, link)
      assert.equal((await request(`/join-room/${link}`)).status, 404)
      assert.equal((await request(`/join-room/${fresh}`)).status, 200)
    })
  } finally {
    if (room) await deleteRows('trip_rooms', [{ column: 'id', operator: 'eq', value: room }])
    for (const id of users) await deleteRows('users', [{ column: 'id', operator: 'eq', value: id }])
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await closeDatabase()
  }
})
