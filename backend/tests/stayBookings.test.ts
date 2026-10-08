import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPlanCommand, type PlanDocument } from '../src/services/workingPlan.js'
import { bookingTripDates, stayBookingDates } from '../src/services/stayBookings.js'
import { stayDates, tripDates } from '../../frontend/src/services/bookingDates.ts'
const dates = { start: '2027-01-14', end: '2027-01-17' }
const first = { name: 'First hotel', area: 'Silom', nights: 3 }
const second = { name: 'Second hotel', area: 'Sukhumvit', nights: 3 }
const key = (stay: typeof first) => `${stay.name}|${stay.area}`
const plan = (): PlanDocument => ({ title: 'A shared stay', destination: 'Bangkok', country: 'Thailand', catalogueId: 'fixture', days: [], travelDates: dates, bookings: { destination: 'Bangkok', country: 'Thailand', duration_days: 4, budget: 'Moderate', location_type: 'City', estimated_cost_usd: 480, currency: 'INR', travel_dates: dates, flights: [], stays: [first, second], cover_image: null } })
const mark = (document: PlanDocument, stay: typeof first, booked = true) => applyPlanCommand(document, { type: 'booking', bookingType: 'stay', bookingId: key(stay), booked }).document
test('one shared stay per date range, with idempotent marking and an explicit change of hotel', () => {
  const original = plan()
  const booked = mark(original, first)
  assert.deepEqual(booked.booked?.stays, [key(first)])
  assert.equal(original.booked, undefined)
  assert.deepEqual(mark(booked, first).booked?.stays, [key(first)])
  assert.throws(() => mark(booked, second), { status: 409 })
  const cleared = mark(booked, first, false)
  assert.deepEqual(mark(cleared, second).booked?.stays, [key(second)])
})
test('a split stay can check out and check in on the same day, but cannot share a night', () => {
  const document = plan()
  document.bookings!.stays = [{ ...first, nights: 2, checkIn: '2027-01-14', checkOut: '2027-01-16' }, { ...second, nights: 1, checkIn: '2027-01-16', checkOut: '2027-01-17' }]
  assert.deepEqual(mark(mark(document, first), second).booked?.stays, [key(first), key(second)])
  document.bookings!.stays[1] = { ...second, nights: 2, checkIn: '2027-01-15', checkOut: '2027-01-17' }
  assert.throws(() => mark(mark(document, first), second), { status: 409 })
})
test('unknown dates cannot bypass the overlap check and legacy overlaps can be unmarked', () => {
  const document = plan()
  delete document.travelDates; delete document.bookings!.travel_dates
  assert.throws(() => mark(mark(document, first), second), { status: 409 })
  document.booked = { flights: [], stays: [key(first), key(second)] }
  assert.deepEqual(mark(document, second, false).booked?.stays, [key(first)])
  document.booked.stays = ['Missing hotel|Old area']
  assert.throws(() => mark(document, first), { status: 409 })
})
test('check-in activities cannot bypass hotel booking rules; old flags can still be removed', () => {
  const document = plan()
  document.days = [{ id: 'arrival', title: 'Arrival', items: [{ id: 'check-in', title: 'Settle into Silom', kind: 'stay', time: '14:00', duration: 90, note: 'Leave bags at the hotel', locked: false }] }]
  const command = { type: 'booking', bookingType: 'activity', bookingId: 'check-in', booked: true }
  assert.throws(() => applyPlanCommand(document, command), { status: 409 })
  assert.throws(() => applyPlanCommand(mark(document, first), command), { status: 409 })
  document.days[0].items[0].booked = true
  const cleared = applyPlanCommand(document, { ...command, booked: false }).document
  assert.equal(cleared.days[0].items[0].booked, false)
  const visit = { ...document, days: [{ ...document.days[0], items: [{ ...document.days[0].items[0], kind: 'experience' as const }] }] }
  assert.equal(applyPlanCommand(visit, command).document.days[0].items[0].booked, true)
})
test('server and UI resolve the same hotel dates, including invalid and partial dates', () => {
  const trip = plan().bookings!
  for (const stay of [first, { ...first, nights: 2 }, { ...first, checkIn: '2027-01-15' }, { ...first, checkOut: '2027-01-17' }, { ...first, checkIn: 'bad', checkOut: 'bad' }, { ...first, checkIn: '2027-01-17', checkOut: '2027-01-14' }, { ...first, checkIn: '9999-12-31' }]) {
    assert.deepEqual(stayBookingDates(stay, dates), stayDates(stay, { ...trip, travel_dates: dates, flights: [] , stays: [] }))
  }
  const flights = [{ departDate: dates.start, returnDate: dates.end }]
  assert.deepEqual(bookingTripDates(undefined, flights), dates)
  assert.deepEqual(bookingTripDates(undefined, [...flights, { departDate: '2027-01-15', returnDate: dates.end }]), tripDates({ flights: [] }))
})
