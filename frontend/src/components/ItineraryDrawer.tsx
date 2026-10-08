import { useDestinationPhoto } from '../services/placePhotos'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ExploreItinerary } from '../data/exploreItineraries'
import { Icon } from './Ui'

type Props = { onAddToRoom?: (itinerary: ExploreItinerary) => Promise<void>; itinerary: ExploreItinerary | null; onClose: () => void; onUse: (itinerary: ExploreItinerary) => void }
export function ItineraryDrawer({ itinerary, onClose, onUse, onAddToRoom }: Props) {
  const { src, srcSet, ref, onError } = useDestinationPhoto(itinerary?.destination || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const saveToRoom = async () => { if (!itinerary || !onAddToRoom || saving) return; setSaving(true); setError(''); try { await onAddToRoom(itinerary); onClose() } catch (reason) { setError(reason instanceof Error ? reason.message : 'This idea could not save. Please try again.') } finally { setSaving(false) } }
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!itinerary) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    dialog.current?.showModal(); document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [itinerary])
  if (!itinerary) return null
  return <dialog className="journey-dialog" ref={dialog} aria-labelledby="drawer-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="drawer-image"><img src={src} srcSet={srcSet} sizes="(max-width:700px) 100vw, 800px" ref={ref} onError={onError} alt={`${itinerary.destination}, ${itinerary.country}`} /><button type="button" className="drawer-close" onClick={onClose} aria-label="Close itinerary" autoFocus>×</button><p>{itinerary.destination}, {itinerary.country}</p></div><div className="drawer-content"><span className="drawer-kicker">{itinerary.duration} · {itinerary.budget} · Best in {itinerary.seasons.join(' / ')}</span><h2 id="drawer-title">{itinerary.title}</h2><section className="drawer-why"><p>THE FEEL OF THIS PLACE</p><strong>{itinerary.shortDescription}</strong></section><section><p className="drawer-section-label">A POSSIBLE DAY-BY-DAY RHYTHM</p><div className="day-timeline">{itinerary.dailyPlan.map((day) => <div className="day-plan" key={day.day}><b>{day.day}</b><div><span>Morning</span><p>{day.morning}</p><span>Afternoon</span><p>{day.afternoon}</p><span>Evening</span><p>{day.evening}</p></div></div>)}</div></section>{itinerary.flights && itinerary.flights.length > 0 && <section className="drawer-logistics"><p className="drawer-section-label">FLIGHTS</p><div className="drawer-flights">{itinerary.flights.map((f, i) => <div key={i} className="drawer-flight-row"><span className="drawer-flight-route">{f.from} → {itinerary.destination}</span><span className="drawer-flight-meta">{f.airline} · {f.type}</span><span className="drawer-flight-cost">{f.estimatedCost}</span></div>)}</div></section>}{itinerary.accommodation && <section className="drawer-logistics"><p className="drawer-section-label">WHERE TO STAY</p><div className="drawer-stay"><span className="drawer-stay-type">{itinerary.accommodation.type}</span><strong>{itinerary.accommodation.name}</strong><span className="drawer-stay-price">{itinerary.accommodation.pricePerNight} / night</span><p>{itinerary.accommodation.notes}</p></div></section>}{error && <p className="form-error" role="alert">{error}</p>}<div className="drawer-actions"><button type="button" className="secondary-button" onClick={() => onUse(itinerary)}><Icon name="heart" size={16} />Save to my collection</button><>{onAddToRoom ? <button className="primary-button" disabled={saving} onClick={() => void saveToRoom()}>{saving ? 'Saving…' : 'Save to room ideas'}<Icon /></button> : <Link className="primary-button" to={`/travel-dna/new?${new URLSearchParams({ inspiration: itinerary.id, destination: itinerary.destination, days: String(Number.parseInt(itinerary.duration, 10) || 4) })}`} onClick={onClose}>Start a quest here <Icon /></Link>}</></div></div></dialog>
}
