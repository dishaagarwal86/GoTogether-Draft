import { useEffect } from 'react'
import type { ExploreItinerary } from '../data/exploreItineraries'

type Props = { itinerary: ExploreItinerary | null; onClose: () => void; onUse: (itinerary: ExploreItinerary) => void }

export function ItineraryDrawer({ itinerary, onClose, onUse }: Props) {
  useEffect(() => {
    if (!itinerary) return
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [itinerary, onClose])

  if (!itinerary) return null
  return <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}><aside className="itinerary-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" onMouseDown={(event) => event.stopPropagation()}>
    <div className="drawer-image"><img src={itinerary.image} alt="" /><button type="button" className="drawer-close" onClick={onClose} aria-label="Close itinerary">×</button><p>{itinerary.destination}, {itinerary.country}</p></div>
    <div className="drawer-content"><span className="drawer-kicker">{itinerary.duration} · {itinerary.budget} · Best in {itinerary.seasons[0]}</span><h2 id="drawer-title">{itinerary.title}</h2><section className="drawer-why"><p>Journey notes</p><strong>{itinerary.shortDescription}</strong></section><section><p className="drawer-section-label">Day-by-day rhythm</p><div className="day-timeline">{itinerary.dailyPlan.map((day) => <div className="day-plan" key={day.day}><b>{day.day}</b><div><span>Morning</span><p>{day.morning}</p><span>Afternoon</span><p>{day.afternoon}</p><span>Evening</span><p>{day.evening}</p></div></div>)}</div></section><button className="use-inspiration" type="button" onClick={() => onUse(itinerary)}>Save as inspiration <span>→</span></button></div>
  </aside></div>
}
