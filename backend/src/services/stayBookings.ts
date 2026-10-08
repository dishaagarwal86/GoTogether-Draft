import { calendarDate, type TravelDates } from './travelDates.js'

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {}
const addDays = (value: string, nights: number) => value ? calendarDate(new Date(Date.parse(`${value}T00:00:00Z`) + nights * 86400000).toISOString().slice(0, 10)) : ''
export function bookingTripDates(saved: unknown, flights: unknown[] = []): TravelDates {
  const range = object(saved), start = calendarDate(range.start), end = calendarDate(range.end)
  if (start || end) return { start, end: start && end && end < start ? '' : end }
  const first = object(flights[0]), depart = calendarDate(first.departDate), back = calendarDate(first.returnDate)
  return depart && back && back >= depart && flights.every(value => { const route = object(value); return route.departDate === depart && route.returnDate === back }) ? { start: depart, end: back } : { start: '', end: '' }
}
export function stayBookingDates(value: unknown, range: unknown): TravelDates {
  const stay = object(value), trip = object(range)
  const start = calendarDate(stay.checkIn), end = calendarDate(stay.checkOut)
  const nights = typeof stay.nights === 'number' && Number.isInteger(stay.nights) && stay.nights > 0 && stay.nights <= 60 ? stay.nights : 0
  if (stay.checkIn || stay.checkOut) return {
    start: start || (!stay.checkIn && nights ? addDays(end, -nights) : ''),
    end: start && end && end < start ? '' : end || (!stay.checkOut && nights ? addDays(start, nights) : ''),
  }
  const first = calendarDate(trip.start), last = calendarDate(trip.end)
  return nights && first && last && addDays(first, nights) === last ? { start: first, end: last } : { start: '', end: '' }
}

// Check-out is exclusive: leaving one hotel and checking into another on the
// same day is valid. Unknown dates cannot prove that two stays are separate.
export function staysConflict(first: TravelDates, second: TravelDates): boolean {
  if (!first.start || !first.end || first.end <= first.start || !second.start || !second.end || second.end <= second.start) return true
  return first.start < second.end && second.start < first.end
}
