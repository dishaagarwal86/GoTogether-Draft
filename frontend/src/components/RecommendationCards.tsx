import { useRef, useState } from 'react'
import type { QuestDna, QuestRecommendation } from '../apis/quests'
import { Icon } from './Ui'
import { ItineraryStory, type ChatContext } from './ItineraryStory'
import { photoFallback, recommendationPhoto } from '../services/itineraryPresentation'

type Props = { results: QuestRecommendation[]; roomId: string; travelDna?: QuestDna | null; workspace?: boolean; onDiscuss?: (context: ChatContext) => void }
export function RecommendationCards({ results, roomId, travelDna, workspace = false, onDiscuss }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(() => workspace ? results[0]?.id ?? null : null)
  const selected = results.find((trip) => trip.id === selectedId) ?? (workspace ? results[0] : undefined)
  const storyRef = useRef<HTMLDivElement>(null)
  const choose = (trip: QuestRecommendation) => {
    setSelectedId(trip.id)
    if (!workspace) window.requestAnimationFrame(() => { storyRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); storyRef.current?.focus({ preventScroll: true }) })
  }
  return <div className={workspace ? 'quest-itinerary-picker' : 'recommendation-collection'}>
    <div className={workspace ? 'quest-route-options' : 'path-grid'} aria-label="Itinerary ideas">{results.map((trip) => <article className={`${workspace ? 'quest-route-option' : 'path-card'}${selected?.id === trip.id ? ' is-selected' : ''}`} key={trip.id}>
      {workspace ? <button type="button" className="quest-route-choice" aria-label={`Explore this itinerary: ${trip.destination}, ${trip.duration_days} days`} aria-pressed={selected?.id === trip.id} onClick={() => choose(trip)}><img src={recommendationPhoto(trip)} alt="" onError={photoFallback} /><span className="quest-route-label">{trip.label}</span><span className="quest-route-destination">{trip.destination}{selected?.id === trip.id && <Icon name="check" size={16} />}</span><span className="quest-route-meta">{trip.duration_days} days · {trip.budget}</span></button> : <><div className="path-card-photo"><img src={recommendationPhoto(trip)} alt={`${trip.destination} travel inspiration`} loading="lazy" onError={photoFallback} /><span className="path-photo-country"><Icon name="pin" size={13} />{trip.country}</span></div><div><span className="path-label">{trip.label}</span><p className="section-kicker">{trip.destination}, {trip.country}</p><h2>{trip.title}</h2><p>{trip.short_description}</p><small>{trip.duration_days} days · {trip.budget}<br />{trip.matchedPreferences.join(' · ') || 'An idea to explore with your crew'}</small><button type="button" className="text-button" aria-expanded={selected?.id === trip.id} onClick={() => choose(trip)}>Explore this itinerary <Icon size={17} /></button></div></>}
    </article>)}</div>
    {selected && <div className="itinerary-selection" ref={storyRef} tabIndex={-1}><ItineraryStory key={selected.id} trip={selected} roomId={roomId} travelDna={travelDna} onDiscuss={onDiscuss} /></div>}
  </div>
}
