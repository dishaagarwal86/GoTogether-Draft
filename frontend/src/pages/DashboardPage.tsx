import { destinationPhotos } from '../data/destinationPhotos'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useQuests } from '../hooks/useQuests'
import { useSavedTrips } from '../services/journeyStorage'
import { EmptyState, ErrorState, Icon, LoadingState, PageHeading } from '../components/Ui'
import { QuestCard } from '../components/QuestCard'
import { TravelArtwork } from '../components/TravelArtwork'
import { exploreItineraries } from '../data/exploreItineraries'
import mountains from '../assets/landing/mountains.jpg'

export function DashboardPage() {
  const { user } = useAuth()
  const { quests, loading, error, retry } = useQuests()
  const { saved } = useSavedTrips()
  const location = useLocation()
  const firstName = user?.firstName || 'explorer'
  return <section className="dashboard-page"><PageHeading eyebrow="A LITTLE LESS SOMEDAY. A LITTLE MORE TOGETHER." title={<>{location.state?.welcome ? 'Welcome aboard' : 'Good to see you'}, <em>{firstName}.</em></>} description="Your people, your possibilities, and everything still to come." />
    <div className="dashboard-top-grid"><section className="dashboard-feature"><img src={mountains} alt="A winding trail through a sunlit alpine valley" /><div className="dashboard-feature-shade" /><div><p className="eyebrow">THE NEXT CHAPTER IS YOURS</p><h2>What if we<br /><em>just went?</em></h2><p>The place can come later.<br />Start with the people you want beside you.</p><Link className="primary-button coral-button" to="/travel-dna/new">Start a new quest <Icon name="northeast" /></Link></div><span className="feature-caption"><Icon name="pin" size={15} /> SOMEWHERE OUT THERE, A GOOD STORY.</span></section>
    <aside className="dashboard-notebook"><div className="notebook-heading"><Icon name="spark" /><span>FROM SOMEDAY TO LET’S GO</span></div><h2>Good trips start{' '}<br />with <em>small steps.</em></h2><ol className="journey-checklist"><li><span className="done"><Icon name="check" size={16} /></span><div><strong>Make yourself at home</strong><small>Your account is ready to go.</small></div></li><li><span className={quests.length ? 'done' : ''}>{quests.length ? <Icon name="check" size={16} /> : '02'}</span><div><Link to="/travel-dna/new">Give your adventure a name <span>↗</span></Link><small>Big idea. Small first step.</small></div></li><li><span>03</span><div><Link to={quests[0] ? `/quests/${quests[0].id}` : '/travel-dna/new'}>Bring your people along <span>↗</span></Link><small>A shared plan starts with a shared invite.</small></div></li></ol><div className="notebook-note"><TravelArtwork motif="ticket" className="notebook-ticket" /><p>No perfect itinerary needed.{' '}<br />Just a little curiosity.</p></div></aside></div>
    <div className="dashboard-section-heading"><div><p className="eyebrow">YOUR ADVENTURES, TOGETHER</p><h2>Plans with <em>possibility.</em></h2></div><Link className="text-button" to="/trips">All quests <Icon size={17} /></Link></div>
    {loading ? <LoadingState label="Finding your quests…" /> : error ? <ErrorState message={error} retry={retry} /> : quests.length ? <div className="journey-quest-grid">{quests.slice(0, 3).map((quest, index) => <QuestCard quest={quest} index={index} key={quest.id} />)}</div> : <EmptyState title="Your first “remember when” starts here." description="Name a quest, find your shared travel style, and bring the group chat a little closer to going." to="/travel-dna/new" label="Make your first plan" />}
    <div className="dashboard-section-heading"><div><p className="eyebrow">A LITTLE FUEL FOR YOUR WANDERLUST</p><h2>Somewhere <em>good.</em></h2></div><Link className="text-button" to="/explore">Find your somewhere <Icon size={17} /></Link></div><div className="dashboard-inspiration">{['amalfi', 'bali', 'kyoto'].map((id) => { const trip = exploreItineraries.find((item) => item.id === id)!; return <Link key={id} to={`/explore?place=${id}`}><img src={destinationPhotos[id]} alt={`${trip.destination}, ${trip.country}`} loading="lazy" /><div><span>{trip.country} · {trip.duration}</span><h3>{trip.destination}<Icon name="northeast" size={21} /></h3></div></Link> })}</div>
    <div className="saved-reminder"><span><Icon name="heart" /> Keep the places that make you pause.</span><Link to="/saved">Your saved collection{saved.length > 0 ? ` (${saved.length})` : ''} <Icon size={16} /></Link></div>
  </section>
}
