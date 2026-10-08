import type { BookingTrip, QuestDna, TripFlight, TripStay } from '../apis/quests'
import { usePlacePhoto } from '../services/placePhotos'
import { PlacePhotoCaption } from './PlacePhotoCaption'
import { Icon } from './Ui'
import { PlaceSourceNote } from './PlaceSourceNote'
import { SourcedStayOptions } from './SourcedStayOptions'

const bookingFlightsUrl = 'https://www.booking.com/flights/index.html'

const accommodationByType: Record<string, Record<string, string>> = {
  'Islands':      { 'Budget-friendly': 'Sea-view guesthouse or self-catered apartment', 'Moderate': 'Boutique hotel near the harbour', 'Premium': 'Clifftop villa or private suite with views' },
  'Beach':        { 'Budget-friendly': 'Beachside guesthouse or surf hostel', 'Moderate': 'Garden villa or design hotel near the shore', 'Premium': 'Beachfront resort with private pool' },
  'City':         { 'Budget-friendly': 'Aparthotel or city-centre hostel', 'Moderate': 'Boutique hotel in the old town', 'Premium': 'Rooftop design hotel or heritage suite' },
  'Mountains':    { 'Budget-friendly': 'Mountain inn or shared chalet', 'Moderate': 'Alpine lodge with valley views', 'Premium': 'Luxury mountain retreat or private cabin' },
  'Countryside':  { 'Budget-friendly': 'Local guesthouse or homestay', 'Moderate': 'Heritage villa or eco-lodge', 'Premium': 'Private estate or boutique countryside retreat' },
  'Hidden gems':  { 'Budget-friendly': 'Family guesthouse or local pensione', 'Moderate': 'Artisan boutique hotel', 'Premium': 'Private heritage property or design hideaway' },
}

function stayFor(trip: BookingTrip): string {
  const byType = accommodationByType[trip.location_type]
  if (byType) return byType[trip.budget] ?? byType['Moderate']
  return trip.budget === 'Premium' ? 'Boutique hotel or resort' : trip.budget === 'Budget-friendly' ? 'Guesthouse or apartment stay' : 'Design hotel or home rental'
}

function money(amount: number, currency = 'USD') {
  if (!Number.isFinite(amount) || amount <= 0) return 'Check price'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount) }
  catch { return `${currency} ${Math.round(amount).toLocaleString()}` }
}
const shortDate = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : ''

export const flightBookingKey = (flight: TripFlight) => [flight.flightNumber, flight.airline, flight.fromCode, flight.toCode, flight.departDate].join('|')
export const stayBookingKey = (stay: TripStay) => [stay.name, stay.area].join('|')

function FlightCard({ flight, currency, booked, disabled, onBook }: { flight: TripFlight; currency: string; booked: boolean; disabled: boolean; onBook?: (booked: boolean) => void }) {
  return <article className="trip-flight">
    <header><span className="trip-flight-airline"><Icon name="plane" size={18} />Route to explore</span></header>
    <div className="trip-flight-leg"><div><strong>{flight.fromCode || flight.from}</strong><small>{flight.from}</small></div><div className="trip-flight-line"><small>Compare routes</small><i /></div><div><strong>{flight.toCode || flight.to}</strong><small>{flight.to}</small></div></div>
    {flight.departDate && <dl className="trip-flight-dates"><div><dt>Depart</dt><dd>{shortDate(flight.departDate)}</dd></div><div><dt>Return</dt><dd>{shortDate(flight.returnDate)}</dd></div></dl>}
    <footer><div><strong>{money(flight.pricePerPerson, currency)}</strong><small>Estimated budget per person, round trip</small></div><div className="trip-booking-actions"><a className="text-button" href={bookingFlightsUrl} title="Search flights on Booking.com" target="_blank" rel="noreferrer">Check flights <Icon size={15} /></a>{onBook && <button type="button" className={booked ? 'booking-confirmed' : 'booking-mark'} disabled={disabled} onClick={() => onBook(!booked)}>{booked ? 'Booked ✓' : 'I booked this'}</button>}</div></footer>
  </article>
}

function StayCard({ stay, trip, currency, travellers, booked, disabled, onBook }: { stay: TripStay; trip: BookingTrip; currency: string; travellers: number; booked: boolean; disabled: boolean; onBook?: (booked: boolean) => void }) {
  const { src, srcSet, ref, onError, description, alt } = usePlacePhoto({ placeId: stay.placeSource?.placeId, title: stay.name, destination: trip.destination, imageQuery: stay.imageQuery, area: stay.area, kind: 'stay' })
  const search = new URLSearchParams({ ss: `${stay.name}, ${trip.destination}`, group_adults: String(travellers), ...(trip.travel_dates?.start ? { checkin: trip.travel_dates.start, checkout: trip.travel_dates.end } : {}) })
  return <article className="trip-stay">
    <img src={src} srcSet={srcSet} sizes="(max-width: 700px) 90vw, 640px" ref={ref} alt={alt} loading="lazy" decoding="async" onError={onError} />
    <div className="trip-stay-main">
      <h4>{stay.name}</h4>
      <p className="trip-stay-area"><Icon name="pin" size={13} />{[stay.area, trip.destination].filter(Boolean).join(', ')} · {stay.type}</p>
      <small>Stay idea to research. Check current property details.</small><PlacePhotoCaption description={description} />
      <PlaceSourceNote source={stay.placeSource} />
    </div>
    <div className="trip-stay-side">
      <div className="trip-stay-price"><small>{stay.nights} night{stay.nights === 1 ? '' : 's'} · estimated room cost</small><strong>{money(stay.totalPrice, currency)}</strong><small>{money(stay.pricePerNight, currency)} per room per night</small></div>
      <a className="secondary-button" href={`https://www.booking.com/searchresults.html?${search}`} target="_blank" rel="noreferrer">See availability</a>{onBook && <button type="button" className={booked ? 'booking-confirmed' : 'booking-mark'} disabled={disabled} onClick={() => onBook(!booked)}>{booked ? 'Booked ✓' : 'I booked this'}</button>}
    </div>
  </article>
}

export function TravelPlanningOptions({ trip, travelDna, booked = { flights: [], stays: [] }, disabled = false, onBookingChange }: { trip: BookingTrip; travelDna?: QuestDna | null; booked?: { flights: string[]; stays: string[] }; disabled?: boolean; onBookingChange?: (type: 'flight' | 'stay', id: string, booked: boolean) => void }) {
  const departureCities = travelDna?.departureCities ?? []
  const travellers = Math.max(1, travelDna?.groupSize ?? 1)
  const currency = trip.currency ?? 'USD'
  const staySearch = new URLSearchParams({ ss: trip.destination, group_adults: String(travellers) })
  if (trip.flights?.length || trip.stays?.length) return <section className="travel-planning-options trip-bookings" aria-label="Flights and stays">
    <div><p className="eyebrow">BUILD YOUR TRIP</p><h3>Flights & stays</h3><small>AI planning estimates, not live quotes. Check routes, property details, room capacity and availability before booking.</small></div>
    {!!trip.flights?.length && <><h5 className="trip-bookings-heading">Flights</h5><div className="trip-flights">{trip.flights.map(flight => { const id = flightBookingKey(flight); return <FlightCard key={id} flight={flight} currency={currency} booked={booked.flights.includes(id)} disabled={disabled} onBook={onBookingChange ? next => onBookingChange('flight', id, next) : undefined} /> })}</div></>}
    {!trip.flights?.length && <p>No flight route was suggested. <a className="text-button" href={bookingFlightsUrl} title="Search flights on Booking.com" target="_blank" rel="noreferrer">Check flights <Icon size={15} /></a></p>}
    {!!trip.stays?.length && <><h5 className="trip-bookings-heading">Places to stay</h5><div className="trip-stays">{trip.stays.map(stay => { const id = stayBookingKey(stay); return <StayCard key={id} stay={stay} trip={trip} currency={currency} travellers={travellers} booked={booked.stays.includes(id)} disabled={disabled} onBook={onBookingChange ? next => onBookingChange('stay', id, next) : undefined} /> })}</div></>}
    {!trip.stays?.length && <p>No stay was suggested. <a className="text-button" href={`https://www.booking.com/searchresults.html?${staySearch}`} target="_blank" rel="noreferrer">Find places to stay <Icon size={15} /></a></p>}
    {trip.estimated_cost_usd > 0 && <p className="trip-bookings-total">Estimated total: <strong>{money(trip.estimated_cost_usd, 'USD')}</strong> per person for the whole trip</p>}
    <SourcedStayOptions trip={trip} />
  </section>
  return <section className="travel-planning-options" aria-label="Flights and stays">
    <div><p className="eyebrow">BUILD YOUR TRIP</p><h3>Flights & stays</h3><small>Start with a flight search or find a place to stay. Prices and availability are checked on the booking site.</small></div>
    <div className="travel-option-grid">
      <article><Icon name="plane" size={23} /><p>Flight approach</p><strong>{departureCities.length ? `Flights from ${departureCities.slice(0, 2).join(' and ')} to ${trip.destination}` : `Compare flexible arrival options into ${trip.destination}`}</strong><small>{departureCities.length ? 'Compare airlines, timing, and layover options before booking.' : 'Choose the best departure city and timing for your crew before booking.'}</small><a className="text-button" href={bookingFlightsUrl} title="Search flights on Booking.com" target="_blank" rel="noreferrer">Check flights <Icon size={15} /></a></article>
      <article><Icon name="home" size={23} /><p>Stay style</p><strong>{stayFor(trip)}</strong><small>Best aligned with this {trip.budget.toLowerCase()} itinerary and its {trip.duration_days}-day pace.</small><a className="text-button" href={`https://www.booking.com/searchresults.html?${staySearch}`} target="_blank" rel="noreferrer">Find places to stay <Icon size={15} /></a></article>
    </div>
    <SourcedStayOptions trip={trip} />
  </section>
}
