import { Link, useLocation, useNavigate } from 'react-router-dom'
import { demoTravellers } from '../data/groupMockData'
import { getScoredItineraries } from '../services/recommendationEngine'
import { CompanionPanel } from '../components/CompanionPanel'

export function GroupDnaPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isGroup = Boolean(location.state?.isGroup)
  const top = getScoredItineraries()[0]
  return <section className="flow-page dna-page"><div className="flow-topbar"><Link className="back-link" to="/travel-dna/overview">← Your quest</Link><span className="flow-step">{isGroup ? 'Group insight' : 'Personal insight'}</span></div><header className="dna-hero"><p className="eyebrow">{isGroup ? 'Your group, decoded' : 'Your travel style, decoded'}</p><h1>{isGroup ? <>Meet your shared <em>Travel DNA.</em></> : <>Meet your <em>Travel DNA.</em></>}</h1><p className="lede">{isGroup ? 'A practical picture of what will make this journey feel good for everyone.' : 'A practical picture of the kind of journey that will feel most like you.'}</p><div className="dna-orbit">{(isGroup ? demoTravellers : demoTravellers.slice(0, 1)).map((traveller) => <span key={traveller.name}>{traveller.initials}</span>)}<b>✦</b></div></header><div className="dna-insights"><article><p className="section-kicker">{isGroup ? 'Shared energy' : 'Your energy'}</p><h2>Curious, restorative explorer</h2><p>Local flavour, open-air moments and enough breathing room make the strongest foundation for this quest.</p></article><article><p className="section-kicker">Best rhythm</p><h2>One active anchor, plenty of ease</h2><p>Choose a memorable experience, then leave enough unscheduled time for the journey to unfold.</p></article><article><p className="section-kicker">Strongest fit today</p><h2>{top.destination}</h2><p>{top.whyItFits}</p></article></div><div className="dna-actions">{isGroup ? <button className="primary-button" type="button" onClick={() => navigate('/travel-dna/plan-paths')}>See our plan paths <span>→</span></button> : <Link className="primary-button" to="/explore">Explore my matches <span>→</span></Link>}<Link className="text-button" to="/explore">Explore all itineraries <span>→</span></Link></div><CompanionPanel context={{ travellers: isGroup ? demoTravellers : 1 }} /></section>
}
