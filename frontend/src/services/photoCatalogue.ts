import records from '../data/placePhotos.json'
import type { Photo } from './activityPhotos'

export type CataloguePhoto = Photo & {
  placeId: string; name: string; destination: string; destinations: string[]; aliases: string[];
  kind?: 'place' | 'stay' | 'area'; variants?: { url: string; width: number; height: number }[];
}
export const normalizePlace = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\b(kichjoji|kichijouji)\b/g, 'kichijoji')
const photos = records as CataloguePhoto[]
const byId = new Map(photos.map(photo => [photo.placeId, photo]))
const scenes: Record<string, string> = {
  ...Object.fromEntries(photos.filter(photo => photo.kind === 'area').flatMap(photo => [photo.name, ...photo.aliases].map(name => [normalizePlace(name), photo.placeId]))),
  tokyo: 'tokyo-city', kichijoji: 'tokyo-kichijoji', shimokitazawa: 'tokyo-shimokitazawa', nakameguro: 'tokyo-nakameguro',
  koenji: 'tokyo-koenji', kanda: 'tokyo-kanda', okutama: 'tokyo-okutama', odaiba: 'tokyo-odaiba', kagurazaka: 'tokyo-kagurazaka', tsukishima: 'tokyo-tsukishima',
  kyoto: 'kyoto-fushimi-inari', bali: 'bali-tanah-lot', ubud: 'bali-monkey-forest',
  barcelona: 'barcelona-park-guell', santorini: 'santorini-ammoudi', interlaken: 'interlaken-lake-brienz',
  kerala: 'kerala-fishing-nets', kochi: 'kerala-fishing-nets', 'fort kochi': 'kerala-fishing-nets', cochin: 'kerala-fishing-nets',
  marrakech: 'scene-marrakech', cappadocia: 'scene-cappadocia', iceland: 'scene-iceland', amalfi: 'scene-amalfi', 'amalfi coast': 'scene-amalfi',
}
const sceneNames = Object.keys(scenes).sort((a, b) => b.length - a.length)
export function knownPhotoDestination(destination: string) {
  const key = normalizePlace(destination)
  return sceneNames.find(name => key === name || key.startsWith(`${name} `))
}
export function destinationPhoto(destination: string) {
  const match = knownPhotoDestination(destination)
  return match ? byId.get(scenes[match]) : undefined
}
export function matchingPlacePhoto({ placeId, title, destination, imageQuery, kind }: { placeId?: string; title: string; destination: string; imageQuery?: string; kind?: string }) {
  if (placeId && byId.has(placeId)) return byId.get(placeId)
  const location = normalizePlace(destination)
  const text = normalizePlace(title.split(' — ')[0])
  const query = normalizePlace(imageQuery ?? '')
  const inText = (text: string, name: string) => ` ${text} `.includes(` ${name} `)
  return photos.filter(photo => photo.destinations.some(value => inText(location, normalizePlace(value))) && (kind !== 'stay' || photo.kind === 'stay'))
    .flatMap(photo => [photo.name, ...photo.aliases].map(normalizePlace).filter(name => name.length >= 5 && (kind === 'stay' ? text === name : inText(text, name) || inText(query, name))).map(name => ({photo, score: name.length})))
    .sort((a,b) => b.score-a.score)[0]?.photo
}
export const photoSrcSet = (photo?: CataloguePhoto | null) => photo?.variants?.map(item => `${item.url} ${item.width}w`).join(', ')
