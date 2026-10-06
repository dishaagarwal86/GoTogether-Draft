import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getUserQuests, type Quest } from '../apis/quests'
import { useAuth } from '../auth/AuthContext'

export function PlanTripPage() {
  const navigate = useNavigate()
  const { user, requestSignIn } = useAuth()
  const [quests, setQuests] = useState<Quest[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => { if (!user) { setQuests([]); return } setLoading(true); getUserQuests(user.id).then(setQuests).finally(() => setLoading(false)) }, [user])
  const continueTo = (path: string, state?: object) => user ? navigate(path, { state }) : requestSignIn()

  return (
    <section className="flow-page plan-page">
      <div className="flow-topbar"><Link className="back-link" to="/">← Home</Link><span className="flow-step">1 / 3</span></div>
      <div className="flow-heading"><p className="eyebrow">A new treasure awaits</p><h1>Plan your new <em>quest.</em></h1><p className="lede">Tell us what matters to your crew and we’ll shape a quest around your group.</p></div>
      <div className="room-layout">
        <section className="room-list-panel"><div className="flow-section-heading"><div><p className="section-kicker">Your quest log</p><h2>Your quests</h2></div><span className="room-count">{quests.length} saved</span></div><div className="room-list">{loading && <p className="form-hint">Loading your quests…</p>}{!loading && !quests.length && <p className="form-hint">Your saved quests will appear here.</p>}{quests.map((quest) => <button className="room-card quest-card" type="button" key={quest.id} onClick={() => navigate(`/quests/${quest.id}`)}><img className="quest-card-image" src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=85" alt="" /><span className="room-card-copy"><span className="quest-status-badge upcoming">{quest.role === 'owner' ? 'Hosting' : 'Joined'}</span><strong>{quest.name}</strong><small>{quest.tripName}</small><span className="quest-traits"><i>Saved quest</i><i>{quest.members} travellers</i></span><span className="quest-travellers"><span className="quest-avatar-stack"><b>{`${user?.firstName[0] ?? ''}${user?.lastName[0] ?? ''}`}</b></span><em>{quest.role === 'owner' ? 'Your quest' : 'Invited by your crew'}</em></span></span><span className="room-arrow">→</span></button>)}</div></section>
        <section className="new-room-panel"><span className="new-room-mark">+</span><p className="section-kicker">Start from scratch</p><h2>Plan your new quest</h2><p>Tell us what matters to your crew and we’ll shape a quest around your group.</p><button className="primary-button" type="button" onClick={() => continueTo('/travel-dna/new')}>Plan a new quest <span>→</span></button></section>
      </div>
    </section>
  )
}
