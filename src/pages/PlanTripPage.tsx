import { Link, useNavigate } from 'react-router-dom'
import { existingRooms } from '../data/PlanTrip'

export function PlanTripPage() {
  const navigate = useNavigate()

  return (
    <section className="flow-page plan-page">
      <div className="flow-topbar"><Link className="back-link" to="/">← Home</Link><span className="flow-step">1 / 3</span></div>
      <div className="flow-heading"><p className="eyebrow">Make space for a new story</p><h1>Plan your <em>trip.</em></h1><p className="lede">Choose an existing room or start a new one with your favorite people.</p></div>
      <div className="room-layout">
        <section className="room-list-panel"><div className="flow-section-heading"><div><p className="section-kicker">Your rooms</p><h2>Existing rooms</h2></div><span className="room-count">{existingRooms.length} active</span></div><div className="room-list">{existingRooms.map((room) => <button className="room-card" type="button" key={room.name} onClick={() => navigate('/room/questions', { state: { roomName: room.name, tripName: room.detail } })}><span className={`room-icon ${room.color}`}>↗</span><span className="room-card-copy"><strong>{room.name}</strong><small>{room.detail} · {room.members}</small></span><span className="room-arrow">→</span></button>)}</div></section>
        <section className="new-room-panel"><span className="new-room-mark">+</span><p className="section-kicker">Start from scratch</p><h2>Create a new room</h2><p>Give your group a place to gather ideas, compare preferences, and make a plan together.</p><button className="primary-button" type="button" onClick={() => navigate('/room/new')}>Create new room <span>→</span></button></section>
      </div>
    </section>
  )
}
