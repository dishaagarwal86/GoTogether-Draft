import type { SyntheticEvent } from 'react'
import type { QuestRecommendation } from '../apis/quests'
import { destinationPhotos } from '../data/destinationPhotos'
import { exploreItineraries } from '../data/exploreItineraries'
import placeholder from '../assets/travel-placeholder.svg'

export function recommendationPhoto(trip: Pick<QuestRecommendation, 'destination' | 'cover_image'>) {
  return trip.cover_image?.trim() || destinationPhotos[trip.destination.toLowerCase()] || exploreItineraries.find((item) => item.destination.toLowerCase() === trip.destination.toLowerCase())?.image || placeholder
}
export function photoFallback(event: SyntheticEvent<HTMLImageElement>) {
  if (event.currentTarget.src !== new URL(placeholder, window.location.href).href) event.currentTarget.src = placeholder
}
