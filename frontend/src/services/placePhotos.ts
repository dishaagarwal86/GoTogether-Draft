import { useState, type SyntheticEvent } from 'react'
import { destinationPhotos } from '../data/destinationPhotos'
import { useActivityPhoto } from './activityPhotos'
import { destinationPhoto, matchingPlacePhoto, normalizePlace, photoSrcSet, type CataloguePhoto } from './photoCatalogue'
import placeholder from '../assets/travel-placeholder.svg'

function useResolvedPhoto(matched: CataloguePhoto | undefined, scene: CataloguePhoto | undefined, queries: Array<string | undefined>, destination: string, width: 1280 | 3840) {
  const [failed, setFailed] = useState<string[]>([])
  const local = matched && !failed.includes(matched.url) ? matched : null
  const fallback = scene?.url || destinationPhotos[normalizePlace(destination.split(',')[0])] || placeholder
  const { src: remoteSrc, ref, credit: remoteCredit, onError: remoteError } = useActivityPhoto(local ? [] : queries, fallback, width)
  const src = local?.url || remoteSrc
  const shown = local || (src === scene?.url ? scene : null)
  const credit = local || remoteCredit || shown
  const description = local ? local.kind === 'area' ? `Area view · ${local.name}` : '' : remoteCredit ? 'Illustrative photo' : src === placeholder ? 'Travel illustration' : `Area view · ${scene?.name || destination}`
  const srcSet = failed.includes(`${src}:responsive`) ? undefined : photoSrcSet(shown)
  const onError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (srcSet && event.currentTarget.currentSrc !== new URL(src, location.href).href) setFailed(values => [...values, `${src}:responsive`])
    else if (local) setFailed(values => [...values, local.url])
    else remoteError(event)
  }
  return { src, srcSet, ref, credit, onError, description, alt: local?.name || description }
}

export function usePlacePhoto(input: { placeId?: string; title: string; destination: string; imageQuery?: string; area?: string; kind?: string }) {
  const matched = matchingPlacePhoto(input)
  const scene = destinationPhoto(input.area || '') || destinationPhoto(input.destination)
  const queries = input.kind === 'stay' && scene ? [] : [input.imageQuery, `${input.title.split(' — ')[0]} ${input.destination}`.trim()]
  return useResolvedPhoto(matched, scene, queries, input.destination, 1280)
}

export function useDestinationPhoto(destination: string) {
  const photo = destinationPhoto(destination)
  return useResolvedPhoto(photo, undefined, destination.trim() ? [destination] : [], destination, 3840)
}
