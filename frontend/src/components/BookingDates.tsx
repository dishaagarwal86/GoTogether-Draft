import { formatTravelDate, type TravelDates } from '../services/bookingDates'
import '../styles/booking-dates.css'

export function BookingDates({ dates, stay = false }: { dates: TravelDates; stay?: boolean }) {
  return <dl className="booking-travel-dates" aria-label={stay ? 'Stay dates' : 'Flight dates'}>
    {[{ label: stay ? 'Check-in' : 'Depart', value: dates.start }, { label: stay ? 'Check-out' : 'Return', value: dates.end }].map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value ? <time dateTime={value}>{formatTravelDate(value)}</time> : <span>Date to confirm</span>}</dd></div>)}
  </dl>
}
