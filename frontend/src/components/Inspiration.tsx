import { useRef, useState, type CSSProperties } from 'react'
import { trips } from '../data/trips'
import { Reveal } from './Reveal'

const filters = ['✦ Mood · Rest & reset', '⌖ Location · Anywhere', '☼ Season · This autumn', '↗ Budget · Comfortable']

export function Inspiration() {
  const [saved, setSaved] = useState<string[]>([])
  const cardsRef = useRef<HTMLDivElement>(null)
  const toggleSaved = (place: string) => setSaved((current) => current.includes(place) ? current.filter((item) => item !== place) : [...current, place])

  return (
    <Reveal className="section-block inspiration-block">
      <div className="section-heading">
        <div><p className="section-kicker">Picked for your group</p><h2>Itineraries for you <span className="sparkle">✦</span></h2></div>
        <div className="carousel-controls"><button type="button" onClick={() => cardsRef.current?.scrollBy({ left: -260, behavior: 'smooth' })} aria-label="Previous">←</button><button type="button" onClick={() => cardsRef.current?.scrollBy({ left: 260, behavior: 'smooth' })} aria-label="Next">→</button></div>
      </div>
      <div className="filter-row">{filters.map((filter) => <button className="filter-chip" type="button" key={filter}>{filter}<span>⌄</span></button>)}</div>
      <div className="itinerary-grid" ref={cardsRef}>
        {trips.map((trip, index) => <article className="itinerary-card" style={{ '--card-index': index } as CSSProperties} key={trip.place}>
          <div className="image-wrap"><img src={trip.image} alt={trip.place} /><button className={saved.includes(trip.place) ? 'save-button saved' : 'save-button'} type="button" onClick={() => toggleSaved(trip.place)} aria-label={`Save ${trip.place}`}>{saved.includes(trip.place) ? '♥' : '♡'}</button><span className="match-label">{trip.match} match</span></div>
          <div className="itinerary-copy"><div><h3>{trip.place}</h3><span>↗</span></div><p>{trip.detail}</p><small>{trip.dates}</small></div>
        </article>)}
      </div>
    </Reveal>
  )
}
