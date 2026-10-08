import { formatTravelRange, tripDates } from '../services/bookingDates'
import { useEffect, useState } from 'react'
import type { BookingTrip } from '../apis/quests'
import { apiUrl } from '../services/apiUrl'
import type { AreaIdea } from '../services/workingPlanApi'
import { PlaceSourceNote } from './PlaceSourceNote'
import { PlacePhotoCaption } from './PlacePhotoCaption'
import { usePlacePhoto } from '../services/placePhotos'

function SourcedStayCard({ stay, destination }: { stay: AreaIdea; destination: string }) {
  const { src, srcSet, ref, onError, description, alt } = usePlacePhoto({ placeId: stay.placeSource?.placeId, title: stay.title, destination, imageQuery: stay.imageQuery, area: stay.area, kind: 'stay' })
  return <article>
    <img src={src} srcSet={srcSet} sizes="(max-width: 700px) 90vw, 640px" ref={ref} alt={alt} loading="lazy" decoding="async" onError={onError} />
    <div><strong>{stay.title}</strong><p>{stay.area}</p><PlacePhotoCaption description={description} /><PlaceSourceNote source={stay.placeSource} /></div>
  </article>
}

export function SourcedStayOptions({ trip }: { trip: BookingTrip }) {
  const [result, setResult] = useState<{ key: string; places: AreaIdea[] } | null>(null)
  const query = new URLSearchParams({ destination: trip.destination, country: trip.country ?? '' }).toString()
  useEffect(() => {
    const controller = new AbortController()
    void fetch(apiUrl(`/itineraries/places?${query}`), { signal: controller.signal }).then(async response => {
      if (!response.ok) return
      const body = await response.json() as { data: { places: AreaIdea[] } }
      if (!controller.signal.aborted) setResult({ key: query, places: body.data.places })
    }).catch(() => { /* Flight and stay searches remain usable if the catalogue cannot load. */ })
    return () => controller.abort()
  }, [query])
  const shown = new Set(trip.stays?.map(stay => stay.placeSource?.placeId))
  const stays = result?.key === query ? result.places.filter(place => place.kind === 'stay' && place.placeSource && !shown.has(place.placeSource.placeId)) : []
  if (!stays.length) return null
  return <div className="sourced-stays" aria-label="Stays from official sources">
    <h4>Real stays to explore</h4><p className="booking-trip-dates">Trip dates · {formatTravelRange(tripDates(trip))} · Availability to check</p><p>A starting point for your research. Compare rates, room capacity and your budget on the property’s site.</p>
    <div className="sourced-stays-grid">{stays.map(stay => <SourcedStayCard key={stay.placeSource!.placeId} stay={stay} destination={trip.destination} />)}</div>
  </div>
}
