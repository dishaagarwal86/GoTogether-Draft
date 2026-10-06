import { destinationPhotos } from '../data/destinationPhotos'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { ExploreItinerary } from '../data/exploreItineraries'
import { Icon } from './Ui'

type Props = { itinerary: ExploreItinerary | null; onClose: () => void; onUse: (itinerary: ExploreItinerary) => void }
export function ItineraryDrawer({ itinerary, onClose, onUse }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!itinerary) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    dialog.current?.showModal(); document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [itinerary])
  if (!itinerary) return null
  return <dialog className="journey-dialog" ref={dialog} aria-labelledby="drawer-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="drawer-image"><img src={destinationPhotos[itinerary.id] ?? itinerary.image} alt={`${itinerary.destination}, ${itinerary.country}`} /><button type="button" className="drawer-close" onClick={onClose} aria-label="Close itinerary" autoFocus>×</button><p>{itinerary.destination}, {itinerary.country}</p></div><div className="drawer-content"><span className="drawer-kicker">{itinerary.duration} · {itinerary.budget} · Best in {itinerary.seasons.join(' / ')}</span><h2 id="drawer-title">{itinerary.title}</h2><section className="drawer-why"><p>THE FEEL OF THIS PLACE</p><strong>{itinerary.shortDescription}</strong></section><section><p className="drawer-section-label">A POSSIBLE DAY-BY-DAY RHYTHM</p><div className="day-timeline">{itinerary.dailyPlan.map((day) => <div className="day-plan" key={day.day}><b>{day.day}</b><div><span>Morning</span><p>{day.morning}</p><span>Afternoon</span><p>{day.afternoon}</p><span>Evening</span><p>{day.evening}</p></div></div>)}</div></section><div className="drawer-actions"><button type="button" className="secondary-button" onClick={() => onUse(itinerary)}><Icon name="heart" size={16} />Save to my collection</button><Link className="primary-button" to={`/travel-dna/new?inspiration=${itinerary.id}`} onClick={onClose}>Start a quest here <Icon /></Link></div></div></dialog>
}
