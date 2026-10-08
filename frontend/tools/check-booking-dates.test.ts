import assert from 'node:assert/strict'
import test from 'node:test'
import { calendarDate, flightDates, tripDates, stayDates, itineraryDayDate, formatTravelDate, planDates, stayDateParams, flightBookingKey, stayBookingKey, conflictingStay, hasStayConflict, uniqueStays } from '../src/services/bookingDates.ts'
import type { BookingTrip, TripFlight, TripStay } from '../src/apis/quests.ts'
const trip: BookingTrip = { destination: 'Bangkok', budget: 'Moderate', location_type: 'City', duration_days: 4, estimated_cost_usd: 480, travel_dates: { start: '2027-01-14', end: '2027-01-17' } }
test('missing flight dates use the saved trip while explicit dates and booking identity survive', () => {
  const flight = { departDate: '', returnDate: '', flightNumber: '', airline: '', fromCode: 'HYD', toCode: 'BKK' } as TripFlight
  const key = flightBookingKey(flight)
  assert.deepEqual(flightDates(flight, trip), trip.travel_dates)
  assert.equal(flightBookingKey(flight), key)
  assert.deepEqual(flightDates({ departDate: '2027-01-13', returnDate: '' }, trip), { start: '2027-01-13', end: '2027-01-17' })
  assert.deepEqual(flightDates({ departDate: '', returnDate: '2027-01-17' }), { start: '', end: '2027-01-17' })
  assert.deepEqual(flightDates({ departDate: '2027-01-19', returnDate: '' }, trip), { start: '2027-01-19', end: '' })
})
test('hotel dates and search dates agree without assigning the whole trip to a shorter stay', () => {
  assert.deepEqual(stayDates({ nights: 3 }, trip), trip.travel_dates)
  assert.deepEqual(stayDateParams(stayDates({ nights: 3 }, trip)), { checkin: '2027-01-14', checkout: '2027-01-17' })
  assert.deepEqual(stayDates({ nights: 2 }, trip), { start: '', end: '' })
  assert.deepEqual(stayDateParams(stayDates({ nights: 2 }, trip)), {})
  assert.deepEqual(stayDates({ nights: 2, checkIn: '2027-01-15' }, trip), { start: '2027-01-15', end: '2027-01-17' })
  assert.deepEqual(stayDates({ nights: 2, checkOut: '2027-01-16' }, trip), { start: '2027-01-14', end: '2027-01-16' })
  assert.deepEqual(stayDates({ nights: 3, checkIn: '2027-01-17', checkOut: '2027-01-14' }, trip), { start: '2027-01-17', end: '' })
  assert.deepEqual(stayDates({ nights: 0 }, trip), { start: '', end: '' })
})
test('calendar dates stay correct across years, leap days, DST and client time zones', () => {
  assert.equal(calendarDate('2027-02-29'), '')
  assert.equal(calendarDate('2028-02-29'), '2028-02-29')
  assert.equal(calendarDate('2027-13-01'), '')
  assert.equal(formatTravelDate('broken'), 'Date to confirm')
  assert.equal(itineraryDayDate({ start: '2026-12-31', end: '2027-01-03' }, 2), '2027-01-02')
  assert.equal(itineraryDayDate({ start: '2027-03-13', end: '2027-03-16' }, 2), '2027-03-15')
  assert.equal(itineraryDayDate({ start: '2027-01-14', end: '2027-01-17' }, 4), '')
  assert.equal(formatTravelDate('2027-01-14'), 'Thu, 14 Jan 2027')
})
test('legacy booking metadata and an unambiguous flight pair can supply trip dates', () => {
  assert.deepEqual(planDates({ bookings: trip }), trip.travel_dates)
  assert.deepEqual(planDates({ travelDates: { start: '2027-02-01', end: '2027-02-04' }, bookings: trip }), { start: '2027-02-01', end: '2027-02-04' })
  const route = { departDate: '2027-01-14', returnDate: '2027-01-17' } as TripFlight
  assert.deepEqual(tripDates({ flights: [route, route] }), trip.travel_dates)
  assert.deepEqual(tripDates({ flights: [route, { ...route, departDate: '2027-01-15' }] }), { start: '', end: '' })
  assert.deepEqual(planDates({}), { start: '', end: '' })
})
test('hotel options identify overlaps, allow adjacent split stays, and deduplicate the same option', () => {
  const first = { name: 'First hotel', area: 'Silom', nights: 3 } as TripStay
  const second = { name: 'Second hotel', area: 'Sukhumvit', nights: 3 } as TripStay
  const booked = [stayBookingKey(first)]
  const options = { ...trip, stays: [first, second] }
  assert.equal(conflictingStay(second, options, booked), first.name)
  assert.equal(conflictingStay(first, options, booked), undefined)
  assert.equal(hasStayConflict(options, booked), false)
  assert.equal(hasStayConflict(options, [...booked, stayBookingKey(second)]), true)
  assert.deepEqual(uniqueStays([first, { ...first }, second]), [first, second])
  first.checkIn = '2027-01-14'; first.checkOut = '2027-01-16'; first.nights = 2
  second.checkIn = '2027-01-16'; second.checkOut = '2027-01-17'; second.nights = 1
  assert.equal(conflictingStay(second, options, booked), undefined)
  second.checkIn = '2027-01-15'
  assert.equal(conflictingStay(second, options, booked), first.name)
  second.checkIn = 'invalid'; second.checkOut = 'invalid'
  assert.equal(conflictingStay(second, options, booked), first.name)
})
