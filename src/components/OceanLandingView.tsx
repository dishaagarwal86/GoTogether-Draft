import { Link } from 'react-router-dom'
import { landingDestinations } from '../data/landingDestinations'
import { DestinationCard } from './DestinationCard'

/** Stateless home-page view. Navigation behavior stays in the router and page layer. */
export function OceanLandingView() {
  return <section className="ocean-landing">
    <div className="water-photo" aria-hidden="true" />
    <div className="landing-frame">
      <nav className="ocean-nav" aria-label="Main navigation">
        <Link className="ocean-brand" to="/" aria-label="GoTogether home"><span>⌁</span> go together</Link>
        <div className="ocean-links"><a href="#popular">Discover</a><a href="#popular">Journeys</a><a href="#popular">About us</a><Link className="explore-link" to="/plan">Explore <span>↗</span></Link></div>
      </nav>
      <div className="landing-content">
        <div className="landing-copy">
          <p className="landing-kicker">WANDER FREELY · TOGETHER</p>
          <h1>The world feels<br />better <i>shared.</i></h1>
          <p className="landing-lede">Find beautiful places, make a plan, and turn the journey into a story everyone remembers.</p>
          <Link className="start-journey" to="/plan">Start a journey <span>→</span></Link>
        </div>
        <div className="water-caption"><span className="caption-line" /> <p>GILI AIR, INDONESIA<br /><b>08° 21' 34.7" S</b></p></div>
      </div>
      <div id="popular" className="destination-area">
        <div className="destination-title"><p>CURATED FOR YOU</p><h2>Go where you<br />feel alive.</h2></div>
        <div className="destination-cards">{landingDestinations.map((destination) => <DestinationCard destination={destination} key={destination.place} />)}</div>
      </div>
      <form className="journey-search" onSubmit={(event) => event.preventDefault()}>
        <label><span className="search-icon">⌖</span><small>DESTINATION</small><strong>Where do you want to go?</strong></label>
        <label><span className="search-icon">□</span><small>WHEN</small><strong>Choose your dates</strong></label>
        <label><span className="search-icon">◌</span><small>TRAVELLERS</small><strong>2 guests</strong></label>
        <Link to="/plan" className="search-submit">Search <span>→</span></Link>
      </form>
    </div>
    <p className="scroll-note">SCROLL TO EXPLORE <span>↓</span></p>
  </section>
}
