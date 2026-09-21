import { Link, useLocation } from 'react-router-dom'

export function RoomOverviewPage() {
  const location = useLocation()
  const roomName = location.state?.roomName ?? 'Your trip room'
  const answers = location.state?.answers as Record<string, string> | undefined

  return <section className="flow-page overview-page"><div className="flow-topbar"><Link className="back-link" to="/">← Dashboard</Link><span className="room-live"><i /> Room is live</span></div><div className="overview-hero"><p className="eyebrow">Trip room ready</p><h1>{roomName}</h1><p className="lede">Your group now has a shared place to shape the next adventure.</p><button className="primary-button" type="button">Invite more people <span>→</span></button></div><div className="overview-grid"><section className="overview-panel"><p className="section-kicker">Group pulse</p><h2>Your preferences</h2><div className="answer-list">{Object.entries(answers ?? { pace: 'Not answered yet', budget: 'Not answered yet', weather: 'Not answered yet' }).map(([key, value]) => <div key={key}><span>{key}</span><strong>{value}</strong></div>)}</div></section><section className="overview-panel suggestion-panel"><span className="panel-symbol">✦</span><p className="section-kicker">Next up</p><h2>Find a place everyone will love.</h2><p>Once your group has answered, suggested itineraries will appear here.</p><Link className="text-button" to="/inspiration">Browse inspiration <span>→</span></Link></section></div></section>
}
