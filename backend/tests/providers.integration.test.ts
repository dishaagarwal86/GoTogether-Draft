import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { registerUser, loginUser, userForToken, endSession } from '../src/services/authService.js'
import { createRoom, listRooms, listUserRooms, inviteToRoom, updateRoom } from '../src/services/roomService.js'
import { getTripRoomInvite, acceptTripRoomInvite } from '../src/services/invitationService.js'
import { createQuestMessage, listQuestMessages } from '../src/services/chatService.js'
import * as entities from '../src/services/apiStore.js'
import { selectRows, insertRow, updateRows, deleteRows, upsertRow, insertIfMissing, verifyDatabaseConnection, closeDatabase } from '../src/storage.js'

test(`database contract (${process.env.DATABASE_PROVIDER})`, async (t) => {
  // Never run this destructive fixture test with ordinary app credentials.
  assert.equal(process.env.DATABASE_URL, 'postgres://provider_test:provider_test@127.0.0.1:55436/gotogether_provider_test')
  assert.equal(process.env.NODE_ENV, 'test')
  const suffix = randomUUID()
  const email = `provider-${suffix}@example.invalid`
  const password = 'Synthetic test password 2026!'
  let userId = ''
  let guestId = ''
  let roomId = ''
  let token = ''
  let countryId = ''
  let catalogueId = ''
  let preferenceId = ''
  let itineraryId = ''

  try {
    await t.test('startup checks the selected provider and schema', async () => {
      await verifyDatabaseConnection()
    })
    await t.test('registration normalises identity and returns a safe session', async () => {
      const result = await registerUser({ firstName: '  Travel ', lastName: ' Tester ', email: `  ${email.toUpperCase()}  `, password })
      userId = result.user.id
      token = result.token
      assert.equal(result.user.email, email)
      assert.equal(result.user.firstName, 'Travel')
      assert.equal(result.user.lastName, 'Tester')
      assert.equal(result.user.country, null)
      assert.ok(Number.isFinite(Date.parse(result.user.createdAt)))
      assert.equal('password_hash' in result.user, false)
      assert.equal((await userForToken(token))?.id, userId)
      await assert.rejects(registerUser({ firstName: 'Duplicate', lastName: 'User', email, password }), /already exists/)
    })
    await t.test('login rejects bad passwords and untrusted query values', async () => {
      await assert.rejects(loginUser(email, 'incorrect'), /incorrect/)
      await assert.rejects(loginUser("' OR 1=1 --", password), /incorrect/)
      const result = await loginUser(email.toUpperCase(), password)
      assert.equal(result.user.id, userId)
      await endSession(result.token)
      assert.equal(await userForToken(result.token), undefined)
    })
    await t.test('room writes and timestamps have the same shape', async () => {
      const room = await createRoom({ name: "  Summer's adventure  ", tripName: ' Kyoto ', members: 3, ownerId: userId })
      roomId = room.id
      assert.equal(room.name, "Summer's adventure")
      assert.equal(room.tripName, 'Kyoto')
      assert.ok(Number.isFinite(Date.parse(room.createdAt)))
      const changed = await updateRoom(roomId, { name: 'Updated crew', members: 4 })
      assert.equal(changed?.name, 'Updated crew')
      assert.equal(changed?.members, 4)
      assert.equal(changed?.tripName, 'Kyoto')
      assert.ok((await listRooms()).some((entry) => entry.id === roomId))
      assert.equal(await updateRoom(`missing-${suffix}`, { name: 'Absent' }), undefined)
    })
    await t.test('invitation reissue, acceptance, and membership work without sending email', async (t) => {
      assert.equal(process.env.SMTP_HOST, '')
      let inviteToken = ''
      t.mock.method(console, 'info', (...args: unknown[]) => {
        const match = args.join(' ').match(/\/invite\/([a-f0-9]+)/)
        if (match) inviteToken = match[1]
      })
      const guestEmail = `guest-${suffix}@example.invalid`
      const guest = await registerUser({ firstName: 'Guest', lastName: 'Traveller', email: guestEmail, password })
      guestId = guest.user.id
      const owned = await listUserRooms(userId)
      assert.equal(owned.length, 1)
      assert.equal(owned[0].role, 'owner')
      assert.equal(owned[0].inviteStatus, 'accepted')
      assert.deepEqual(await listUserRooms(guestId), [])
      assert.equal(await inviteToRoom(`missing-${suffix}`, guestEmail), undefined)
      assert.equal((await inviteToRoom(roomId, ` ${guestEmail.toUpperCase()} `))?.delivered, false)
      assert.ok(inviteToken)
      const oldToken = inviteToken
      const first = await getTripRoomInvite(oldToken)
      assert.equal(first?.email, guestEmail)
      assert.equal(typeof first?.expiresAt, 'string')
      await inviteToRoom(roomId, guestEmail)
      assert.notEqual(inviteToken, oldToken)
      assert.equal(await getTripRoomInvite(oldToken), undefined)
      const invites = await selectRows('trip_room_invites', ['id'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }])
      assert.equal(invites.length, 1)
      await assert.rejects(acceptTripRoomInvite(inviteToken, { id: userId, email }), /email address/)
      await upsertRow('trip_room_people', { trip_room_id: roomId, user_id: guestId, role: 'member', invite_status: 'invited' }, ['trip_room_id', 'user_id'])
      await assert.rejects(listQuestMessages(roomId, guestId), /accepted quest members/)
      assert.equal((await acceptTripRoomInvite(inviteToken, guest.user)).id, roomId)
      assert.equal(await getTripRoomInvite(inviteToken), undefined)
      await assert.rejects(acceptTripRoomInvite(inviteToken, guest.user), /no longer available/)
      const joined = await listUserRooms(guestId)
      assert.equal(joined.length, 1)
      assert.equal(joined[0].role, 'member')
      assert.equal(joined[0].inviteStatus, 'accepted')
      assert.deepEqual(await selectRows('trip_rooms', ['id'], [{ column: 'id', operator: 'in', value: [] }]), [])
    })
    await t.test('chat keeps membership checks, sender names, ordering, and message validation', async () => {
      assert.deepEqual(await listQuestMessages(roomId, userId), [])
      await assert.rejects(createQuestMessage(roomId, `outsider-${suffix}`, 'Hello'), /accepted quest members/)
      await assert.rejects(listQuestMessages(roomId, `outsider-${suffix}`), /accepted quest members/)
      await assert.rejects(createQuestMessage(roomId, userId, '  '), /2,000 characters/)
      await assert.rejects(createQuestMessage(roomId, userId, 'a'.repeat(2001)), /2,000 characters/)
      const first = await createQuestMessage(roomId, userId, "  Let's visit Kyoto!  ")
      const second = await createQuestMessage(roomId, guestId, 'Sounds good')
      assert.equal(first.body, "Let's visit Kyoto!")
      assert.equal(first.senderName, 'Travel Tester')
      assert.equal(second.senderName, 'Guest Traveller')
      assert.equal(typeof first.createdAt, 'string')
      await updateRows('trip_room_messages', { created_at: '2027-01-01T00:00:00Z' }, [{ column: 'id', operator: 'eq', value: first.id }], ['id'])
      await updateRows('trip_room_messages', { created_at: '2027-01-02T00:00:00Z' }, [{ column: 'id', operator: 'eq', value: second.id }], ['id'])
      const messages = await listQuestMessages(roomId, guestId)
      assert.deepEqual(messages.map((message) => message.id), [first.id, second.id])
      assert.deepEqual(messages.map((message) => message.senderName), ['Travel Tester', 'Guest Traveller'])
      assert.equal(messages[0].createdAt, '2027-01-01T00:00:00.000Z')
    })
    await t.test('JSONB objects, arrays, strings, and nulls round-trip in preferences', async () => {
      const input = {
        userId, tripRoomId: roomId, budget: 'Moderate', peopleCount: 4, kidsInvolved: false,
        dates: { start: '2027-04-01', flexible: true }, locationPreferences: { destination: 'Kyoto' },
        moodPreferences: ['Food & Culture', 'Nature'], activitiesMustHave: 'A local food walk',
        activitiesPreferred: null, accommodationPreferences: ['Ryokan'],
      }
      const preference = await entities.create('preferences', 'pref_test', input)
      preferenceId = preference.id
      const read = await entities.find('preferences', preferenceId)
      assert.deepEqual(read?.moodPreferences, input.moodPreferences)
      assert.deepEqual(read?.dates, input.dates)
      assert.equal(read?.activitiesMustHave, input.activitiesMustHave)
      assert.equal(read?.activitiesPreferred, null)
      const [stored] = await selectRows('preferences', ['mood_preferences', 'dates', 'activities_must_have', 'activities_preferred', 'people_count'], [{ column: 'id', operator: 'eq', value: preferenceId }])
      assert.deepEqual(stored.mood_preferences, input.moodPreferences)
      assert.deepEqual(stored.dates, input.dates)
      assert.equal(stored.activities_must_have, input.activitiesMustHave)
      assert.equal(stored.activities_preferred, null)
      assert.equal(stored.people_count, 4)
      const updated = await entities.update('preferences', preferenceId, { budget: 'Premium', moodPreferences: [], dates: null })
      assert.equal(updated?.budget, 'Premium')
      assert.deepEqual(updated?.moodPreferences, [])
      assert.equal(updated?.dates, null)
      assert.equal(updated?.activitiesMustHave, input.activitiesMustHave)
      assert.equal((await entities.list('preferences', 'userId', userId)).length, 1)
      assert.equal((await entities.list('preferences', 'userId', `unknown-${suffix}`)).length, 0)
    })
    await t.test('entity operations preserve foreign keys and missing-record behavior', async () => {
      const itinerary = await entities.create('itineraries', 'itinerary_test', { userId, title: 'Test itinerary' })
      itineraryId = itinerary.id
      for (const collection of ['flights', 'hotels', 'activities', 'contacts', 'suggestedItineraries'] as const) {
        const item = await entities.create(collection, 'item_test', { userId, itineraryId, label: collection })
        assert.equal((await entities.find(collection, item.id))?.label, collection)
        assert.equal((await entities.list(collection, 'userId', userId)).length, 1)
        if (['flights', 'hotels', 'activities'].includes(collection)) {
          assert.equal((await entities.list(collection, 'itineraryId', itineraryId)).length, 1)
        }
        assert.equal(await entities.remove(collection, item.id), true)
        assert.equal(await entities.remove(collection, item.id), false)
        assert.equal(await entities.find(collection, item.id), undefined)
        assert.equal(await entities.update(collection, item.id, { label: 'missing' }), undefined)
      }
      await assert.rejects(entities.create('preferences', 'invalid_test', { userId: `absent-${suffix}` }), /foreign key/i)
    })
    await t.test('country matching and ordering use equivalent provider semantics', async () => {
      countryId = `country_test_${suffix}`
      await insertRow('country_itineraries', { id: countryId, country: 'Japan', title: 'Kyoto', duration: '5 days', budget: 'Moderate' }, ['id'])
      assert.ok((await entities.countryItineraries('jApAn')).some((entry) => entry.id === countryId))
      assert.equal((await entities.countryItineraries("' OR 1=1 --")).length, 0)
      const first = await entities.create('contacts', 'contact_test', { userId, name: 'First' })
      const second = await entities.create('contacts', 'contact_test', { userId, name: 'Second' })
      await updateRows('contacts', { created_at: '2020-01-01T00:00:00Z' }, [{ column: 'id', operator: 'eq', value: first.id }], ['id'])
      await updateRows('contacts', { created_at: '2021-01-01T00:00:00Z' }, [{ column: 'id', operator: 'eq', value: second.id }], ['id'])
      assert.deepEqual((await entities.list('contacts', 'userId', userId)).map((entry) => entry.id), [second.id, first.id])
    })
    await t.test('catalogue insert-only seeding preserves existing rows and JSON arrays', async () => {
      catalogueId = `catalogue_test_${suffix}`
      const row = { id: catalogueId, title: 'Original', destination: 'Kyoto', country: 'Japan', duration_days: 5, budget: 'Moderate', estimated_cost_usd: 1000, seasons: ['Spring'], moods: ['Nature'], location_type: 'City', short_description: 'Test fixture', why_it_fits: 'A shared pace', daily_plan: [{ day: 1, morning: 'A walk' }], ai_context: { pace: 'Slow' } }
      await insertIfMissing('itinerary_catalogue', row)
      await insertIfMissing('itinerary_catalogue', { ...row, title: 'Must not replace' })
      const [stored] = await selectRows('itinerary_catalogue', ['title', 'seasons', 'daily_plan', 'ai_context'], [{ column: 'id', operator: 'eq', value: catalogueId }])
      assert.equal(stored.title, 'Original')
      assert.deepEqual(stored.seasons, row.seasons)
      assert.deepEqual(stored.daily_plan, row.daily_plan)
      assert.deepEqual(stored.ai_context, row.ai_context)
    })
    await t.test('expired and ended sessions cannot authenticate', async () => {
      await updateRows('user_sessions', { expires_at: '2000-01-01T00:00:00Z' }, [{ column: 'token_hash', operator: 'eq', value: createHash('sha256').update(token).digest('hex') }], ['id'])
      assert.equal(await userForToken(token), undefined)
      await endSession(token)
      assert.equal(await userForToken(token), undefined)
    })
    await t.test('unfiltered destructive operations are rejected', async () => {
      await assert.rejects(deleteRows('users', []), /require a filter/)
      await assert.rejects(updateRows('users', { first_name: 'No' }, [], ['id']), /require a filter/)
    })
  } finally {
    if (guestId) await deleteRows('users', [{ column: 'id', operator: 'eq', value: guestId }])
    if (userId) await deleteRows('users', [{ column: 'id', operator: 'eq', value: userId }])
    if (roomId) await deleteRows('trip_rooms', [{ column: 'id', operator: 'eq', value: roomId }])
    if (countryId) await deleteRows('country_itineraries', [{ column: 'id', operator: 'eq', value: countryId }])
    if (catalogueId) await deleteRows('itinerary_catalogue', [{ column: 'id', operator: 'eq', value: catalogueId }])
    await closeDatabase()
  }
})
