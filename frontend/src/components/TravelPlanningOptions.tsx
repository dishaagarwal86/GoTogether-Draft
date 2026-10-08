import type { BookingTrip, QuestDna, TripFlight } from '../apis/quests'
import { Icon } from './Ui'
import { useInrPricing } from '../services/inrPricing'
import { SourcedStayOptions } from './SourcedStayOptions'
import { BookingDates } from './BookingDates'
import { flightBookingKey, flightDates, tripDates, stayDateParams, formatTravelRange } from '../services/bookingDates'
import { StayOptions } from './StayOptions'

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

function FlightCard({ flight, trip, currency, booked, disabled, onBook }: { flight: TripFlight; trip: BookingTrip; currency: string; booked: boolean; disabled: boolean; onBook?: (booked: boolean) => void }) {
  const pricing = useInrPricing(currency)
  return <article className="trip-flight">
    <header><span className="trip-flight-airline"><Icon name="plane" size={18} />Route to explore</span></header>
    <div className="trip-flight-leg"><div><strong>{flight.fromCode || flight.from}</strong><small>{flight.from}</small></div><div className="trip-flight-line"><small>Compare routes</small><i /></div><div><strong>{flight.toCode || flight.to}</strong><small>{flight.to}</small></div></div>
    <BookingDates dates={flightDates(flight, trip)} />
    <footer><div><strong>{pricing.format(flight.pricePerPerson)}</strong><small>Estimated budget per person, round trip</small></div><div className="trip-booking-actions"><a className="text-button" href={bookingFlightsUrl} title="Search flights on Booking.com" target="_blank" rel="noreferrer">Check flights <Icon size={15} /></a>{!onBook && booked && <span className="stay-choice-label is-booked">Marked as booked</span>}{onBook && <button type="button" className={booked ? 'booking-confirmed' : 'booking-mark'} disabled={disabled} onClick={() => onBook(!booked)}>{booked ? 'Booked ✓' : 'I booked this'}</button>}</div></footer>
  </article>
}

export function TravelPlanningOptions({ trip, travelDna, booked = { flights: [], stays: [] }, disabled = false, readOnly = false, onBookingChange }: { trip: BookingTrip; travelDna?: QuestDna | null; booked?: { flights: string[]; stays: string[] }; disabled?: boolean; readOnly?: boolean; onBookingChange?: (type: 'flight' | 'stay', id: string, booked: boolean) => void }) {
  const departureCities = travelDna?.departureCities ?? []
  const travellers = Math.max(1, travelDna?.groupSize ?? 1)
  const currency = trip.currency ?? 'USD'
  const pricing = useInrPricing(currency)
  const totalPricing = useInrPricing('USD')
  const range = tripDates(trip)
  const staySearch = new URLSearchParams({ ss: trip.destination, group_adults: String(travellers), ...stayDateParams(range) })
  if (trip.flights?.length || trip.stays?.length) return <section className="travel-planning-options trip-bookings" aria-label="Flights and stays">
    <div><p className="eyebrow">BUILD YOUR TRIP</p><h3>Flights & stays</h3><small>Planning estimates, not live quotes. Check routes, property details, room capacity and availability before booking.</small></div>
    <p className="booking-trip-dates"><Icon name="calendar" size={16} /><span>Trip dates · <strong>{formatTravelRange(range)}</strong></span></p>
    {!!trip.flights?.length && <><h5 className="trip-bookings-heading">Flights</h5><div className="trip-flights">{trip.flights.map(flight => { const id = flightBookingKey(flight); return <FlightCard key={id} flight={flight} trip={trip} currency={currency} booked={booked.flights.includes(id)} disabled={disabled} onBook={!readOnly && onBookingChange ? next => onBookingChange('flight', id, next) : undefined} /> })}</div></>}
    {!trip.flights?.length && <p>No flight route was suggested. <a className="text-button" href={bookingFlightsUrl} title="Search flights on Booking.com" target="_blank" rel="noreferrer">Check flights <Icon size={15} /></a></p>}
    {!!trip.stays?.length && <StayOptions trip={trip} travellers={travellers} bookedIds={booked.stays} disabled={disabled} readOnly={readOnly} onBook={onBookingChange ? (id, next) => onBookingChange('stay', id, next) : undefined} />}
    {!trip.stays?.length && <p>No stay was suggested. <a className="text-button" href={`https://www.booking.com/searchresults.html?${staySearch}`} target="_blank" rel="noreferrer">Find places to stay <Icon size={15} /></a></p>}
    {trip.estimated_cost_usd > 0 && <p className="trip-bookings-total">Estimated total: <strong>{totalPricing.format(trip.estimated_cost_usd)}</strong> per person for the whole trip</p>}
    <p className="trip-currency-note">{pricing.note} {currency.toUpperCase() !== 'USD' && trip.estimated_cost_usd > 0 && <>Trip total: {totalPricing.note} </>}Bank and booking rates may differ.</p>
    <SourcedStayOptions trip={trip} />
  </section>
  return <section className="travel-planning-options" aria-label="Flights and stays">
    <div><p className="eyebrow">BUILD YOUR TRIP</p><h3>Flights & stays</h3><small>Start with a flight search or find a place to stay. Prices and availability are checked on the booking site.</small></div>
    <p className="booking-trip-dates"><Icon name="calendar" size={16} /><span>Trip dates · <strong>{formatTravelRange(range)}</strong></span></p>
    <div className="travel-option-grid">
      <article><Icon name="plane" size={23} /><p>Flight approach</p><strong>{departureCities.length ? `Flights from ${departureCities.slice(0, 2).join(' and ')} to ${trip.destination}` : `Compare flexible arrival options into ${trip.destination}`}</strong><small>{departureCities.length ? 'Compare airlines, timing, and layover options before booking.' : 'Choose the best departure city and timing for your crew before booking.'}</small><a className="text-button" href={bookingFlightsUrl} title="Search flights on Booking.com" target="_blank" rel="noreferrer">Check flights <Icon size={15} /></a></article>
      <article><Icon name="home" size={23} /><p>Stay style</p><strong>{stayFor(trip)}</strong><small>Best aligned with this {trip.budget.toLowerCase()} itinerary and its {trip.duration_days}-day pace.</small><a className="text-button" href={`https://www.booking.com/searchresults.html?${staySearch}`} target="_blank" rel="noreferrer">Find places to stay <Icon size={15} /></a></article>
    </div>
    <SourcedStayOptions trip={trip} />
  </section>
}
