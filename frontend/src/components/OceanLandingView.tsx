import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const questMoods = [
  { title: 'Slow & scenic', description: 'Coastlines, long lunches, and room to exhale.', mood: 'Relaxation', image: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1500&q=88' },
  { title: 'Taste & culture', description: 'Markets, makers, art, and stories worth sharing.', mood: 'Food & Culture', image: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=1500&q=88' },
  { title: 'Wild & wonder', description: 'Mountain air, open trails, and a little awe.', mood: 'Nature', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1500&q=88' },
  { title: 'After dark', description: 'City energy, late tables, and social nights.', mood: 'Nightlife', image: 'https://images.unsplash.com/photo-1519608487953-e999c86e7454?auto=format&fit=crop&w=1500&q=88' },
]

/** Stateless home-page view. Navigation behavior stays in the router and page layer. */
export function OceanLandingView() {
  const { user, requestSignIn } = useAuth()
  return <>
    <section className="ocean-landing">
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
    </section>
    <section id="popular" className="quest-moods" aria-labelledby="quest-moods-heading">
      <header className="quest-moods-heading"><p>CURATED FOR YOUR GROUP</p><h2 id="quest-moods-heading">What kind of story do you want to <em>share?</em></h2><span>Choose a feeling, or let GoTogether find the fit for your group.</span></header>
      <div className="quest-mood-grid">{questMoods.map((mood) => <Link className="quest-mood-card" to="/explore" state={{ mood: mood.mood }} key={mood.title}><img src={mood.image} alt="" /><div className="quest-mood-overlay" /><div className="quest-mood-copy"><h3>{mood.title}</h3><p>{mood.description}</p><b aria-hidden="true">→</b></div></Link>)}</div>
      <Link className="quest-moods-cta" to="/plan">Not sure yet? Find your group’s fit <span>→</span></Link>
    </section>
  </>
}
