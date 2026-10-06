import { destinationPhotos } from '../data/destinationPhotos'
import type { ExploreItinerary } from '../data/exploreItineraries'

type Props = { itinerary: ExploreItinerary; saved: boolean; onSave: () => void; onView: () => void }

export function ExploreItineraryCard({ itinerary, saved, onSave, onView }: Props) {
  return <article className="explore-card">
    <div className="explore-card-image"><img src={destinationPhotos[itinerary.id] ?? itinerary.image} loading="lazy" alt={`${itinerary.destination}, ${itinerary.country}`} /><div className="explore-card-shade" /><button className={saved ? 'explore-save is-saved' : 'explore-save'} type="button" onClick={onSave} aria-pressed={saved} aria-label={`${saved ? 'Remove' : 'Save'} ${itinerary.destination}`}>{saved ? '♥' : '♡'}</button><p>{itinerary.destination}<small>{itinerary.country}</small></p></div>
    <div className="explore-card-copy"><div className="explore-meta"><span>{itinerary.duration}</span><span>{itinerary.budget}</span><span>Best in {itinerary.seasons[0]}</span></div><h2>{itinerary.title}</h2><p>{itinerary.shortDescription}</p><div className="explore-tags">{itinerary.moods.slice(0, 3).map((mood) => <span key={mood}>{mood}</span>)}</div><button className="view-itinerary" type="button" onClick={onView}>View itinerary <span>→</span></button></div>
  </article>
}
