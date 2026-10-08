import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { demoEnabled } from '../src/demo/config.js'
import { registerUser, endSession } from '../src/services/authService.js'
import { createRoom } from '../src/services/roomService.js'
import { create, update } from '../src/services/apiStore.js'
import { validatePreferencePayload } from '../src/services/preferenceValidation.js'
import { getWorkingPlan, changeWorkingPlan } from '../src/services/workingPlan.js'
import { closeDatabase, insertRow, selectRows, updateRows } from '../src/storage.js'

test('legacy plan dates survive reads, edits and undo without rewriting saved snapshots on read', { skip: !demoEnabled() }, async () => {
  const session = await registerUser({ firstName: 'Calendar', lastName: 'Fixture', email: `calendar.${randomUUID()}@demo.gotogether.test`, password: randomUUID(), country: 'India' })
  try {
    const room = await createRoom({ name: 'Isolated calendar regression', tripName: 'Calendar check', members: 1, ownerId: session.user.id })
    const preference = await create('preferences', 'preference', { userId: session.user.id, ...validatePreferencePayload({ tripRoomId: room.id, dates: { start: '2027-01-14', end: '2027-01-17', flexible: false }, daysCount: 4, budget: 'Moderate', moodPreferences: ['History'], pace: 'A balanced mix', submitted: true }) })
    const document = { title: 'Legacy catalogue plan', destination: 'Bangkok', country: 'Thailand', catalogueId: 'calendar-fixture', days: [1, 2, 3, 4].map(number => ({ id: randomUUID(), title: `Day ${number}`, items: [] })) }
    await insertRow('quest_working_plans', { id: room.id, data: { document, history: [], requests: [] } }, ['id'])
    const filter = [{ column: 'id', operator: 'eq' as const, value: room.id }]
    const original = await selectRows('quest_working_plans', ['data', 'revision'], filter)
    const read = await getWorkingPlan(room.id, session.user.id)
    assert.deepEqual(read?.travelDates, { start: '2027-01-14', end: '2027-01-17' })
    assert.deepEqual(await selectRows('quest_working_plans', ['data', 'revision'], filter), original)
    const edited = await changeWorkingPlan(room.id, session.user.id, { type: 'rename', title: 'Renamed calendar fixture', expectedRevision: read!.revision, requestId: randomUUID() })
    assert.deepEqual(edited.travelDates, read!.travelDates)
    const undone = await changeWorkingPlan(room.id, session.user.id, { type: 'undo', expectedRevision: edited.revision, requestId: randomUUID() })
    assert.equal(undone.title, document.title); assert.deepEqual(undone.travelDates, read!.travelDates)
    await update('preferences', preference.id, { dates: { start: '2027-01-01', end: '2027-01-31', flexible: false } })
    assert.equal((await getWorkingPlan(room.id, session.user.id))?.travelDates, undefined, 'Wider availability is not an exact itinerary')
    await updateRows('quest_working_plans', { data: { document: { ...document, travelDates: { start: '2027-01-14', end: '2027-01-17' } }, history: [], requests: [] } }, filter, ['id'])
    assert.deepEqual((await getWorkingPlan(room.id, session.user.id))?.travelDates, { start: '2027-01-14', end: '2027-01-17' }, 'Saved dates survive changed preferences')
    const dated = (await getWorkingPlan(room.id, session.user.id))!
    const stays = [{ name: 'First test hotel', area: 'Silom', nights: 3 }, { name: 'Second test hotel', area: 'Sukhumvit', nights: 3 }]
    const bookings = { destination: 'Bangkok', country: 'Thailand', duration_days: 4, budget: 'Moderate', location_type: 'City', estimated_cost_usd: 480, travel_dates: dated.travelDates, stays }
    await updateRows('quest_working_plans', { data: { document: { ...document, travelDates: dated.travelDates, bookings }, history: [], requests: [] } }, filter, ['id'])
    const booked = await changeWorkingPlan(room.id, session.user.id, { type: 'booking', bookingType: 'stay', bookingId: 'First test hotel|Silom', booked: true, expectedRevision: dated.revision, requestId: randomUUID() })
    const beforeConflict = await selectRows('quest_working_plans', ['data', 'revision'], filter)
    await assert.rejects(changeWorkingPlan(room.id, session.user.id, { type: 'booking', bookingType: 'stay', bookingId: 'Second test hotel|Sukhumvit', booked: true, expectedRevision: booked.revision, requestId: randomUUID() }), { status: 409 })
    assert.deepEqual(await selectRows('quest_working_plans', ['data', 'revision'], filter), beforeConflict, 'A rejected overlap does not change saved state or revision')
    const cleared = await changeWorkingPlan(room.id, session.user.id, { type: 'booking', bookingType: 'stay', bookingId: 'First test hotel|Silom', booked: false, expectedRevision: booked.revision, requestId: randomUUID() })
    const replaced = await changeWorkingPlan(room.id, session.user.id, { type: 'booking', bookingType: 'stay', bookingId: 'Second test hotel|Sukhumvit', booked: true, expectedRevision: cleared.revision, requestId: randomUUID() })
    assert.deepEqual(replaced.booked?.stays, ['Second test hotel|Sukhumvit'])
  } finally { await endSession(session.token); await closeDatabase() }
})
