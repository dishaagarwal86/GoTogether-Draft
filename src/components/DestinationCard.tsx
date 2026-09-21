import type { LandingDestination } from '../data/landingDestinations'

type DestinationCardProps = {
  destination: LandingDestination
}

/** Presentational UI only: destination card markup lives separately from route logic. */
export function DestinationCard({ destination }: DestinationCardProps) {
  return <article className="ocean-trip-card">
    <img src={destination.image} alt="" />
    <div>
      <small>{destination.country}</small>
      <strong>{destination.place}</strong>
      <span>↗</span>
    </div>
  </article>
}
