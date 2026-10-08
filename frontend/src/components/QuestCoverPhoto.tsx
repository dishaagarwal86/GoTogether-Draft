import { useEffect, useState } from 'react'
import { getRoomPreference, preferenceAnswers } from '../apis/travelDna'
import { DESTINATIONS } from '../data/destinations'
import { useDestinationPhoto } from '../services/placePhotos'
import { knownPhotoDestination } from '../services/photoCatalogue'
import placeholder from '../assets/travel-placeholder.svg'

const knownDestinations = new Set(DESTINATIONS.flatMap(place => [place.toLowerCase(), place.split(',')[0].toLowerCase()]))

export function QuestCoverPhoto({ roomId, userId, destination, tripName }: { roomId: string; userId: string; destination?: string; tripName: string }) {
  const [preferred, setPreferred] = useState('')
  const [failed, setFailed] = useState('')
  useEffect(() => {
    if (destination) return
    let active = true
    let request = 0
    const refresh = async () => {
      const current = ++request
      try {
        const preference = await getRoomPreference(userId, roomId)
        const place = preference ? preferenceAnswers(preference).destination : ''
        if (active && current === request) setPreferred(typeof place === 'string' ? place.trim() : '')
      } catch { /* The room stays usable when its optional cover cannot load. */ }
    }
    void refresh()
    const changed = (event: Event) => { if ((event as CustomEvent).detail === roomId) void refresh() }
    window.addEventListener('gotogether:preferences-updated', changed)
    return () => { active = false; window.removeEventListener('gotogether:preferences-updated', changed) }
  }, [destination, roomId, userId])

  // Never send a free-form room title (which may contain people's names) to a
  // photo provider. Before a plan is chosen, use a saved destination or a known
  // place from the room's destination field.
  const place = destination?.trim() || preferred || (knownDestinations.has(tripName.trim().toLowerCase()) ? tripName.trim() : knownPhotoDestination(tripName) || '')
  const { src, srcSet, ref, onError } = useDestinationPhoto(place)
  const hasPhoto = src !== placeholder && failed !== src
  return <>
    <div className="group-cover-visual" data-has-photo={hasPhoto} aria-hidden="true">
      <img className="group-cover-photo" ref={ref} src={src} srcSet={srcSet} sizes="100vw" alt="" decoding="async" fetchPriority="high" onLoad={() => setFailed('')} onError={event => { setFailed(src); onError(event) }} />
      <div className="group-cover-shade" />
    </div>

  </>
}
