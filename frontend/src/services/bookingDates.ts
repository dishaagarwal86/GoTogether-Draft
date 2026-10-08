import type { BookingTrip, TripFlight, TripStay } from '../apis/quests'
export type TravelDates = { start: string; end: string }
export function calendarDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : ''
}
const orderedDates = (start: unknown, end: unknown): TravelDates => {
  const first = calendarDate(start), last = calendarDate(end)
  return { start: first, end: first && last && last < first ? '' : last }
}
export function tripDates(trip?: Pick<BookingTrip, 'travel_dates' | 'flights'> | null): TravelDates {
  const saved = orderedDates(trip?.travel_dates?.start, trip?.travel_dates?.end)
  if (saved.start || saved.end) return saved
  const routes = trip?.flights ?? []
  const first = routes[0] && orderedDates(routes[0].departDate, routes[0].returnDate)
  return first?.start && first.end && routes.every(route => route.departDate === first.start && route.returnDate === first.end) ? first : { start: '', end: '' }
}
export function planDates(plan: { travelDates?: TravelDates; bookings?: BookingTrip }): TravelDates {
  const saved = orderedDates(plan.travelDates?.start, plan.travelDates?.end)
  return saved.start || saved.end ? saved : tripDates(plan.bookings)
}
export function flightDates(flight: Pick<TripFlight, 'departDate' | 'returnDate'>, trip?: BookingTrip | null): TravelDates {
  const fallback = tripDates(trip)
  return orderedDates(calendarDate(flight.departDate) || fallback.start, calendarDate(flight.returnDate) || fallback.end)
}
export function addCalendarDays(value: string, offset: number): string {
  if (!calendarDate(value) || !Number.isInteger(offset) || Math.abs(offset) > 3660) return ''
  return calendarDate(new Date(Date.parse(`${value}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10))
}
export function stayDates(stay: Pick<TripStay, 'nights' | 'checkIn' | 'checkOut'>, trip?: BookingTrip | null): TravelDates {
  const saved = orderedDates(stay.checkIn, stay.checkOut)
  const nights = Number.isInteger(stay.nights) && stay.nights > 0 && stay.nights <= 60 ? stay.nights : 0
  if (stay.checkIn || stay.checkOut) return { start: saved.start || (!stay.checkIn && nights ? addCalendarDays(saved.end, -nights) : ''), end: saved.end || (!stay.checkOut && nights ? addCalendarDays(saved.start, nights) : '') }
  const range = tripDates(trip)
  // Stay suggestions normally cover the whole trip. A shorter stay needs its
  // own dates; do not silently extend it or send mismatched dates to booking.
  return nights && range.start && range.end && addCalendarDays(range.start, nights) === range.end ? range : { start: '', end: '' }
}
export function itineraryDayDate(range: TravelDates, dayIndex: number): string {
  if (!Number.isInteger(dayIndex) || dayIndex < 0) return ''
  const date = addCalendarDays(range.start, dayIndex)
  return date && (!range.end || date <= range.end) ? date : ''
}
export function formatTravelDate(value?: string, weekday = true): string {
  if (!calendarDate(value)) return 'Date to confirm'
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(new Date(`${value}T00:00:00Z`)).map(part => [part.type, part.value]))
  return `${weekday ? `${parts.weekday}, ` : ''}${parts.day} ${parts.month} ${parts.year}`
}
export function formatTravelRange(range: TravelDates): string {
  if (range.start && range.end) return range.start === range.end ? formatTravelDate(range.start, false) : `${formatTravelDate(range.start, false)} – ${formatTravelDate(range.end, false)}`
  if (range.start) return `${formatTravelDate(range.start, false)} · end date to confirm`
  if (range.end) return `Start date to confirm · ${formatTravelDate(range.end, false)}`
  return 'Dates to confirm'
}
export const stayDateParams = (range: TravelDates): Record<string, string> => range.start && range.end && range.end > range.start ? { checkin: range.start, checkout: range.end } : {}
// Use the stored identity, not display-date fallbacks, so existing booking flags survive.
export const flightBookingKey = (flight: TripFlight) => [flight.flightNumber, flight.airline, flight.fromCode, flight.toCode, flight.departDate].join('|')
export const stayBookingKey = (stay: TripStay) => [stay.name, stay.area].join('|')
export const uniqueStays = (stays: TripStay[]): TripStay[] => stays.filter((stay, index) => stays.findIndex(other => stayBookingKey(other) === stayBookingKey(stay)) === index)

export function conflictingStay(stay: TripStay, trip: BookingTrip, bookedIds: string[]): string | undefined {
  const range = stayDates(stay, trip)
  for (const id of bookedIds) {
    if (id === stayBookingKey(stay)) continue
    const other = trip.stays?.find(value => stayBookingKey(value) === id)
    if (!other) return 'Another saved stay'
    const dates = stayDates(other, trip)
    if (!range.start || !range.end || range.end <= range.start || !dates.start || !dates.end || dates.end <= dates.start || (range.start < dates.end && dates.start < range.end)) return other.name
  }
}
export function hasStayConflict(trip: BookingTrip, bookedIds: string[]): boolean {
  return (trip.stays ?? []).some(stay => bookedIds.includes(stayBookingKey(stay)) && !!conflictingStay(stay, trip, bookedIds))
}
