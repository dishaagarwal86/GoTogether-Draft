import type { QuestRecommendation } from '../apis/quests'
import { Icon } from './Ui'

export function TravelPlanningOptions({ trip }: { trip: QuestRecommendation }) {
  const stay = trip.budget === 'Premium' ? 'Boutique hotel or resort' : trip.budget === 'Budget-friendly' ? 'Guesthouse or apartment stay' : 'Design hotel or home rental'
  return <section className="travel-planning-options" aria-label="Flights and stays">
    <div><p className="eyebrow">BUILD YOUR TRIP</p><h3>Flights & stays</h3><small>Curated planning options — not live prices or availability.</small></div>
    <div className="travel-option-grid">
      <article><Icon name="plane" size={23} /><p>Flight approach</p><strong>Compare flexible arrival options into {trip.destination}</strong><small>Choose the best departure city and timing for your crew before booking.</small></article>
      <article><Icon name="home" size={23} /><p>Stay style</p><strong>{stay}</strong><small>Best aligned with this {trip.budget.toLowerCase()} itinerary and its {trip.duration_days}-day pace.</small></article>
    </div>
  </section>
}
