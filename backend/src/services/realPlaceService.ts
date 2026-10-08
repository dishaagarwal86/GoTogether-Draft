import { realPlaces, type RealPlace } from '../data/realPlaces.js'

const normal = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
// Exact geographic aliases: a place in Kerala must not appear in Kerala, Brazil,
// and knowing one part of Bali does not imply the whole island is nearby.
export function placesForDestination(destination: string, country = ''): RealPlace[] {
  const [city, ...suffix] = destination.split(',').map(normal)
  return realPlaces.filter(place => (!country || normal(country) === normal(place.country))
    && (!suffix.length || suffix.join(' ') === normal(place.country))
    && place.destinations.some(alias => normal(alias) === city))
}

export function searchRealPlaces(destination: string, country: string, search = '') {
  const words = normal(search).split(' ').filter(Boolean)
  return placesForDestination(destination, country).filter(place => {
    const content = normal([place.name, ...place.aliases ?? [], place.area, place.kind, place.category, place.summary].join(' '))
    return words.every(word => content.includes(word))
  }).map(place => ({ title: place.name, kind: place.kind, note: place.summary, area: place.area,
    imageQuery: `${place.name} ${place.destination}`, category: place.category, placeSource: { ...place.source } }))
}

export function resolveRealPlace(id: unknown, title: string, destination: string, country: string, kind?: string) {
  if (typeof id !== 'string') return undefined
  return placesForDestination(destination, country).find(place => place.id === id
    && (!kind || kind === place.kind)
    && [place.name, ...place.aliases ?? []].some(name => normal(name) === normal(title)))
}

export function plannerPlaceContext(destinations: string[]) {
  const places = destinations.length ? realPlaces.filter(place => destinations.some(destination =>
    normal(destination) === normal(place.country) || placesForDestination(destination).some(candidate => candidate.id === place.id))) : realPlaces
  return places.map(place => ({ id: place.id, name: place.name, destination: place.destination, country: place.country,
    area: place.area, kind: place.kind, description: place.summary, sourceCheckedAt: place.source.checkedAt }))
}
