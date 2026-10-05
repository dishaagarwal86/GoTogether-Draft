import { Link, useLocation } from 'react-router-dom'
import type { AnswerValue } from '../data/Questions'

export function RoomOverviewPage() {
  const location = useLocation()
  const travelDnaName = location.state?.travelDnaName ?? 'Your quest'
  const answers = location.state?.answers as Record<string, AnswerValue> | undefined
  const isGroup = Number(answers?.groupSize ?? 1) > 1

  return <section className="flow-page overview-page"><div className="flow-topbar"><Link className="back-link" to="/plan">← Your quests</Link><span className="room-live"><i /> Quest saved</span></div><div className="overview-hero"><p className="eyebrow">Your quest is ready</p><h1>{travelDnaName}</h1><p className="lede">Your preferences are ready to shape a more personal next adventure.</p><Link className="primary-button" to="/travel-dna/group-dna" state={{ isGroup }}>See my travel direction <span>→</span></Link></div><div className="overview-grid"><section className="overview-panel"><p className="section-kicker">Quest pulse</p><h2>Your preferences</h2><div className="answer-list">{Object.entries(answers ?? { pace: 'Not answered yet', budget: 'Not answered yet', weather: 'Not answered yet' }).map(([key, value]) => <div key={key}><span>{key}</span><strong>{Array.isArray(value) ? value.join(', ') : value}</strong></div>)}</div></section><section className="overview-panel suggestion-panel"><span className="panel-symbol">✦</span><p className="section-kicker">{isGroup ? 'When your crew joins' : 'Next up'}</p><h2>{isGroup ? 'Compare paths when everyone has shared.' : 'Find an itinerary that feels like you.'}</h2><p>{isGroup ? 'Group comparisons unlock after each traveller adds their own preferences.' : 'Start exploring ideas shaped around your travel style.'}</p><Link className="text-button" to="/explore">Explore itineraries <span>→</span></Link></section></div></section>
}
