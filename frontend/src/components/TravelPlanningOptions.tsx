import type { BookingTrip, QuestDna, TripFlight, TripStay } from '../apis/quests'
import { useActivityPhoto } from '../services/activityPhotos'
import { photoFallback, recommendationPhoto } from '../services/itineraryPresentation'
import { Icon } from './Ui'

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
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount) }
  catch { return `${currency} ${Math.round(amount).toLocaleString()}` }
}
const shortDate = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : ''
const stopsLabel = (stops: number) => stops === 0 ? 'Direct' : `${stops} stop${stops > 1 ? 's' : ''}`

function FlightCard({ flight, currency, travellers }: { flight: TripFlight; currency: string; travellers: number }) {
  const search = new URLSearchParams({ type: 'ROUNDTRIP', adults: String(travellers), cabinClass: 'ECONOMY', depart: flight.departDate, return: flight.returnDate })
  return <article className="trip-flight">
    <header><span className="trip-flight-airline"><Icon name="plane" size={18} />{flight.airline}</span><small>{flight.flightNumber}</small></header>
    <div className="trip-flight-leg">
      <div><strong>{flight.departTime}</strong><span>{flight.fromCode}</span><small>{flight.from}</small></div>
      <div className="trip-flight-line"><small>{flight.duration}</small><i /><small>{stopsLabel(flight.stops)}</small></div>
      <div><strong>{flight.arriveTime}</strong><span>{flight.toCode}</span><small>{flight.to}</small></div>
    </div>
    <dl className="trip-flight-dates"><div><dt>Depart</dt><dd>{shortDate(flight.departDate)}</dd></div><div><dt>Return</dt><dd>{shortDate(flight.returnDate)}{flight.returnDepartTime && ` · ${flight.returnDepartTime}`}</dd></div></dl>
    <footer><div><strong>{money(flight.pricePerPerson, currency)}</strong><small>per person, round trip{travellers > 1 ? ` · ${money(flight.pricePerPerson * travellers, currency)} for ${travellers}` : ''}</small></div><a className="text-button" href={`https://flights.booking.com/flights/${flight.fromCode}-${flight.toCode}/?${search}`} target="_blank" rel="noreferrer">Check flights <Icon size={15} /></a></footer>
  </article>
}

function StayCard({ stay, trip, currency, travellers }: { stay: TripStay; trip: BookingTrip; currency: string; travellers: number }) {
  const photo = useActivityPhoto([stay.imageQuery, `${stay.name} ${trip.destination}`, stay.area && `${stay.area} ${trip.destination}`, `${trip.destination} hotel`], recommendationPhoto(trip))
  const search = new URLSearchParams({ ss: `${stay.name}, ${trip.destination}`, group_adults: String(travellers), no_rooms: '1', ...(trip.travel_dates?.start ? { checkin: trip.travel_dates.start, checkout: trip.travel_dates.end } : {}) })
  return <article className="trip-stay">
    <img src={photo} alt={stay.name} loading="lazy" onError={photoFallback} />
    <div className="trip-stay-main">
      <h4>{stay.name}{stay.stars > 0 && <span className="trip-stay-stars" aria-label={`${stay.stars} stars`}>{'★'.repeat(stay.stars)}</span>}</h4>
      <p className="trip-stay-area"><Icon name="pin" size={13} />{[stay.area, trip.destination].filter(Boolean).join(', ')} · {stay.type}</p>
      <ul>{stay.highlights.map(item => <li key={item}><Icon name="check" size={13} />{item}</li>)}</ul>
    </div>
    <div className="trip-stay-side">
      {stay.reviewScore > 0 && <div className="trip-stay-review"><span><strong>{stay.reviewLabel}</strong><small>Guest rating</small></span><b>{stay.reviewScore.toFixed(1)}</b></div>}
      <div className="trip-stay-price"><small>{stay.nights} night{stay.nights === 1 ? '' : 's'}, {travellers} adult{travellers === 1 ? '' : 's'}</small><strong>{money(stay.totalPrice, currency)}</strong><small>{money(stay.pricePerNight, currency)} per night</small></div>
      <a className="secondary-button" href={`https://www.booking.com/searchresults.html?${search}`} target="_blank" rel="noreferrer">See availability</a>
    </div>
  </article>
}

export function TravelPlanningOptions({ trip, travelDna }: { trip: BookingTrip; travelDna?: QuestDna | null }) {
  const departureCities = travelDna?.departureCities ?? []
  const travellers = Math.max(1, travelDna?.groupSize ?? 1)
  const currency = trip.currency ?? 'USD'
  if (trip.flights?.length || trip.stays?.length) return <section className="travel-planning-options trip-bookings" aria-label="Flights and stays">
    <div><p className="eyebrow">BUILD YOUR TRIP</p><h3>Flights & stays</h3><small>AI-estimated options for your dates. Prices and availability change, so confirm before booking.</small></div>
    {!!trip.flights?.length && <><h5 className="trip-bookings-heading">Flights</h5><div className="trip-flights">{trip.flights.map(flight => <FlightCard key={`${flight.fromCode}-${flight.airline}`} flight={flight} currency={currency} travellers={travellers} />)}</div></>}
    {!!trip.stays?.length && <><h5 className="trip-bookings-heading">Places to stay</h5><div className="trip-stays">{trip.stays.map(stay => <StayCard key={stay.name} stay={stay} trip={trip} currency={currency} travellers={travellers} />)}</div></>}
    {trip.estimated_cost_usd > 0 && <p className="trip-bookings-total">Estimated total: <strong>{money(trip.estimated_cost_usd, currency)}</strong> per person for the whole trip</p>}
  </section>
  return <section className="travel-planning-options" aria-label="Flights and stays">
    <div><p className="eyebrow">BUILD YOUR TRIP</p><h3>Flights & stays</h3><small>Curated planning options — not live prices or availability.</small></div>
    <div className="travel-option-grid">
      <article><Icon name="plane" size={23} /><p>Flight approach</p><strong>{departureCities.length ? `Flights from ${departureCities.slice(0, 2).join(' and ')} to ${trip.destination}` : `Compare flexible arrival options into ${trip.destination}`}</strong><small>{departureCities.length ? 'Compare airlines, timing, and layover options before booking.' : 'Choose the best departure city and timing for your crew before booking.'}</small></article>
      <article><Icon name="home" size={23} /><p>Stay style</p><strong>{stayFor(trip)}</strong><small>Best aligned with this {trip.budget.toLowerCase()} itinerary and its {trip.duration_days}-day pace.</small></article>
    </div>
  </section>
}
