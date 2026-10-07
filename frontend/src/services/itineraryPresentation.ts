import type { SyntheticEvent } from 'react'
import type { QuestRecommendation } from '../apis/quests'
import { destinationPhotos } from '../data/destinationPhotos'
import { exploreItineraries } from '../data/exploreItineraries'
import mountains from '../assets/landing/mountains.jpg'

export function recommendationPhoto(trip: Pick<QuestRecommendation, 'destination' | 'cover_image'>) {
  return trip.cover_image ?? destinationPhotos[trip.destination.toLowerCase()] ?? exploreItineraries.find((item) => item.destination.toLowerCase() === trip.destination.toLowerCase())?.image ?? mountains
}
export function photoFallback(event: SyntheticEvent<HTMLImageElement>) {
  if (event.currentTarget.src !== new URL(mountains, window.location.href).href) event.currentTarget.src = mountains
}
