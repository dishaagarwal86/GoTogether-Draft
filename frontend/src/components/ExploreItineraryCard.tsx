import { useDestinationPhoto } from '../services/placePhotos'
import type { ExploreItinerary } from '../data/exploreItineraries'

type Props = { itinerary: ExploreItinerary; saved: boolean; onSave: () => void; onView: () => void; label?: string }

export function ExploreItineraryCard({ itinerary, saved, onSave, onView, label }: Props) {
  const { src, srcSet, ref, onError } = useDestinationPhoto(itinerary.destination)
  return <article className="explore-card">
    <div className="explore-card-image"><img src={src} srcSet={srcSet} sizes="(max-width:700px) 90vw, 400px" ref={ref} onError={onError} loading="lazy" alt={`${itinerary.destination}, ${itinerary.country}`} /><div className="explore-card-shade" /><button className={saved ? 'explore-save is-saved' : 'explore-save'} type="button" onClick={onSave} aria-pressed={saved} aria-label={`${saved ? 'Remove' : 'Save'} ${itinerary.destination}`}>{saved ? '♥' : '♡'}</button><p>{itinerary.destination}<small>{itinerary.country}</small></p></div>
    <div className="explore-card-copy">{label && <p className="explore-card-label">{label}</p>}<div className="explore-meta"><span>{itinerary.duration}</span><span>{itinerary.budget}</span><span>Best in {itinerary.seasons[0]}</span></div><h2>{itinerary.title}</h2><p>{itinerary.shortDescription}</p><div className="explore-tags">{itinerary.moods.slice(0, 3).map((mood) => <span key={mood}>{mood}</span>)}</div><button className="view-itinerary" type="button" onClick={onView}>View itinerary <span>→</span></button></div>
  </article>
}
