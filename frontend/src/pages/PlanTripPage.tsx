import { Link, useNavigate } from 'react-router-dom'
import { travelDnaPlans } from '../data/PlanTrip'
import { useAuth } from '../auth/AuthContext'

export function PlanTripPage() {
  const navigate = useNavigate()
  const { user, requestSignIn } = useAuth()
  const continueTo = (path: string, state?: object) => user ? navigate(path, { state }) : requestSignIn()

  return (
    <section className="flow-page plan-page">
      <div className="flow-topbar"><Link className="back-link" to="/">← Home</Link><span className="flow-step">1 / 3</span></div>
      <div className="flow-heading"><p className="eyebrow">A new treasure awaits</p><h1>Plan your new <em>quest.</em></h1><p className="lede">Tell us what matters to your crew and we’ll shape a quest around your group.</p></div>
      <div className="room-layout">
        <section className="room-list-panel"><div className="flow-section-heading"><div><p className="section-kicker">Your quest log</p><h2>Your quests</h2></div><span className="room-count">{travelDnaPlans.length} saved</span></div><div className="room-list">{travelDnaPlans.map((plan) => <button className="room-card quest-card" type="button" key={plan.name} onClick={() => continueTo('/travel-dna/preferences', { travelDnaName: plan.name, tripName: plan.detail })}><img className="quest-card-image" src={plan.image} alt="" /><span className="room-card-copy"><span className={`quest-status-badge ${plan.status}`}>{plan.status}</span><strong>{plan.name}</strong><small>{plan.detail}</small><span className="quest-traits">{plan.traits.map((trait) => <i key={trait}>{trait}</i>)}</span><span className="quest-travellers"><span className="quest-avatar-stack">{plan.travellers.map((traveller) => <b key={traveller}>{traveller}</b>)}</span><em>{plan.members}</em></span></span><span className="room-arrow">→</span></button>)}</div></section>
        <section className="new-room-panel"><span className="new-room-mark">+</span><p className="section-kicker">Start from scratch</p><h2>Plan your new quest</h2><p>Tell us what matters to your crew and we’ll shape a quest around your group.</p><button className="primary-button" type="button" onClick={() => continueTo('/travel-dna/new')}>Plan a new quest <span>→</span></button></section>
      </div>
    </section>
  )
}
