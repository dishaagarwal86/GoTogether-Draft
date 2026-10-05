import { Link } from 'react-router-dom'
import { exploreItineraries } from '../data/exploreItineraries'
import { useAuth } from '../auth/AuthContext'

/** Stateless home-page view. Navigation behavior stays in the router and page layer. */
export function OceanLandingView() {
  const { user, requestSignIn } = useAuth()
  return <section className="ocean-landing">
    <div className="water-photo" aria-hidden="true" />
    <div className="landing-frame">
      <div className="landing-content">
        <div className="landing-copy">
          <p className="landing-kicker">WANDER FREELY · TOGETHER</p>
          <h1>The world feels<br />better <i>shared.</i></h1>
          <p className="landing-lede">Find beautiful places, shape a quest, and turn the journey into a story everyone remembers.</p>
          <Link className="start-journey" to="/plan" onClick={(event) => { if (!user) { event.preventDefault(); requestSignIn() } }}>Begin a quest <span>→</span></Link>
        </div>
      </div>
    </div>
    <div id="popular" className="destination-area">
      <div className="destination-title"><p>CURATED FOR YOU</p><h2>Explore what<br />fits your group.</h2><Link to="/explore" className="mini-explore-link">Explore all itineraries <span>→</span></Link></div>
      <div className="destination-cards">{exploreItineraries.slice(0, 3).map((itinerary) => <Link className="ocean-trip-card" to="/explore" key={itinerary.id}><img src={itinerary.image} alt={`${itinerary.destination}, ${itinerary.country}`} /><div><small>✦ {itinerary.matchScore}% DNA MATCH</small><strong>{itinerary.destination}</strong><span>↗</span></div></Link>)}</div>
    </div>
  </section>
}
