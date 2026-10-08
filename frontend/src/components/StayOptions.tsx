import { useId, useState, type KeyboardEvent } from 'react'
import type { BookingTrip, TripStay } from '../apis/quests'
import { usePlacePhoto } from '../services/placePhotos'
import { useInrPricing } from '../services/inrPricing'
import { conflictingStay, hasStayConflict, stayBookingKey, stayDateParams, stayDates, uniqueStays } from '../services/bookingDates'
import { BookingDates } from './BookingDates'
import { PlacePhotoCaption } from './PlacePhotoCaption'
import { PlaceSourceNote } from './PlaceSourceNote'
import { Icon } from './Ui'
import '../styles/stay-options.css'

type Props = { trip: BookingTrip; travellers: number; bookedIds: string[]; disabled: boolean; readOnly: boolean; onBook?: (id: string, booked: boolean) => void }

export function StayOptions({ trip, travellers, bookedIds, disabled, readOnly, onBook }: Props) {
  const id = useId()
  const stays = uniqueStays(trip.stays ?? [])
  const [viewedId, setViewedId] = useState<string | null>(null)
  const recorded = stays.filter(stay => bookedIds.includes(stayBookingKey(stay)))
  const current = stays.find(stay => stayBookingKey(stay) === viewedId) ?? recorded[0] ?? stays[0]
  if (!current) return null
  const index = stays.indexOf(current), key = stayBookingKey(current)
  const conflict = conflictingStay(current, trip, bookedIds)
  const sameNights = stays.every(stay => {
    const first = stayDates(stays[0], trip), dates = stayDates(stay, trip)
    return first.start && first.end && dates.start === first.start && dates.end === first.end
  })
  const changeTab = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const next = event.key === 'ArrowRight' ? (currentIndex + 1) % stays.length : event.key === 'ArrowLeft' ? (currentIndex + stays.length - 1) % stays.length : event.key === 'Home' ? 0 : event.key === 'End' ? stays.length - 1 : -1
    if (next < 0) return
    event.preventDefault()
    setViewedId(stayBookingKey(stays[next]))
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }
  return <section className="stay-choice-panel" aria-labelledby={`${id}-heading`}>
    <header className="stay-choice-header">
      <div><p className="eyebrow">YOUR PLACE TO COME BACK TO</p><h4 id={`${id}-heading`} data-stay-options tabIndex={-1}>{recorded.length > 1 ? 'Your stays' : recorded.length ? 'Your shared stay' : 'Find your shared stay'}</h4></div>
      <span className="stay-choice-rule"><Icon name="home" size={16} />{recorded.length === 1 ? 'Shared stay selected' : sameNights ? 'Same nights · choose one' : 'Compare dates for each stay'}</span>
    </header>
    <p className="stay-choice-intro">{recorded.length === 1 ? <>{recorded[0].name} is your selected stay. {stays.length > 1 && 'The other options are available to compare.'}</> : <>{stays.length > 1 ? 'Switch between alternatives to compare where to stay. ' : 'Review this stay idea. '}{sameNights ? 'Choose one option for these dates.' : 'Separate stays need non-overlapping check-in and check-out dates.'}</>}</p>
    {readOnly ? <p className="stay-choice-status"><Icon name="people" size={16} /><span><strong>Host manages bookings.</strong> {recorded.length ? 'Your shared stay is marked as booked.' : 'You can explore every option; your host records the shared stay.'}</span></p> : onBook && <p className="stay-choice-status"><Icon name="home" size={16} /><span>{recorded.length ? <>{recorded.length} {recorded.length === 1 ? 'stay marked' : 'stays marked'} as booked.</> : <>No stay marked as booked yet.</>} Comparing an option does not book it.</span></p>}
    {hasStayConflict(trip, bookedIds) && <p className="stay-booking-conflict" role="status">Your marked stays have overlapping or unconfirmed dates. Review your reservations and unmark any extra stay. Unmarking here does not cancel a reservation.</p>}
    {stays.length > 1 && <div className="stay-option-tabs" role="tablist" aria-label="Compare stay options">{stays.map((stay, optionIndex) => <button key={stayBookingKey(stay)} type="button" role="tab" id={`${id}-tab-${optionIndex}`} aria-controls={`${id}-panel`} aria-selected={optionIndex === index} tabIndex={optionIndex === index ? 0 : -1} onClick={() => setViewedId(stayBookingKey(stay))} onKeyDown={event => changeTab(event, optionIndex)}>
      <span>{bookedIds.includes(stayBookingKey(stay)) ? 'SELECTED STAY · BOOKED' : recorded.length ? 'OTHER STAY OPTION' : `OPTION ${optionIndex + 1}`}</span><strong>{stay.area || stay.name}</strong>
    </button>)}</div>}
    <div id={`${id}-panel`} role={stays.length > 1 ? 'tabpanel' : undefined} aria-labelledby={stays.length > 1 ? `${id}-tab-${index}` : undefined} className="trip-stays">
      <StayCard key={key} stay={current} trip={trip} travellers={travellers} booked={bookedIds.includes(key)} disabled={disabled} conflict={conflict} onBook={!readOnly && onBook ? booked => onBook(key, booked) : undefined} />
    </div>
  </section>
}

function StayCard({ stay, trip, travellers, booked, disabled, conflict, onBook }: { stay: TripStay; trip: BookingTrip; travellers: number; booked: boolean; disabled: boolean; conflict?: string; onBook?: (booked: boolean) => void }) {
  const pricing = useInrPricing(trip.currency ?? 'USD')
  const { src, srcSet, ref, onError, description, alt } = usePlacePhoto({ placeId: stay.placeSource?.placeId, title: stay.name, destination: trip.destination, imageQuery: stay.imageQuery, area: stay.area, kind: 'stay' })
  const dates = stayDates(stay, trip)
  const search = new URLSearchParams({ ss: `${stay.name}, ${trip.destination}`, group_adults: String(travellers), ...stayDateParams(dates) })
  return <article className="trip-stay">
    <img src={src} srcSet={srcSet} sizes="(max-width: 700px) 90vw, 320px" ref={ref} alt={alt} loading="lazy" decoding="async" onError={onError} />
    <div className="trip-stay-main">
      <span className={`stay-choice-label${booked ? ' is-booked' : ''}`}>{booked ? 'Selected stay · marked as booked' : 'Other stay option · not selected'}</span>
      <h4>{stay.name}</h4>
      <p className="trip-stay-area"><Icon name="pin" size={13} />{[stay.area, trip.destination].filter(Boolean).join(', ')} · {stay.type}</p>
      <small>Check property details, room capacity and availability.</small><PlacePhotoCaption description={description} />
      <PlaceSourceNote source={stay.placeSource} />
      <BookingDates dates={dates} stay />
    </div>
    <div className="trip-stay-side">
      <div className="trip-stay-price"><small>{stay.nights} night{stay.nights === 1 ? '' : 's'} · estimate per room</small><strong>{pricing.format(stay.totalPrice)}</strong><small>{pricing.format(stay.pricePerNight)} per room per night</small></div>
      <div className="stay-option-actions"><a className="secondary-button" href={`https://www.booking.com/searchresults.html?${search}`} target="_blank" rel="noreferrer">See availability <Icon size={14} /></a>
        {onBook && (booked || !conflict) && <button type="button" className={booked ? 'booking-confirmed' : 'booking-mark'} disabled={disabled} onClick={() => onBook(!booked)}>{booked ? 'Unmark booking' : 'Mark this stay as booked'}</button>}
      </div>
    </div>
    {!booked && conflict && <p className="stay-alternative-note">Alternative only: {conflict} is already marked for overlapping or unconfirmed dates.{onBook && ' Unmark that stay before recording this one.'}</p>}
  </article>
}
