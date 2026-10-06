import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuests } from '../hooks/useQuests'
import { EmptyState, ErrorState, Icon, LoadingState, PageHeading } from '../components/Ui'
import { QuestCard } from '../components/QuestCard'
import { TravelArtwork } from '../components/TravelArtwork'

export function PlanTripPage() {
  const { quests, loading, error, retry } = useQuests()
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const visible = quests.filter((quest) => (tab === 'all' || quest.role === tab) && `${quest.name} ${quest.tripName}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="quests-page"><PageHeading eyebrow="GOOD STORIES NEED A STARTING POINT" title={<>Your people.<br />Your <em>quests.</em></>} description="A home for the trips you’re dreaming up together." action={<Link className="primary-button" to="/travel-dna/new"><Icon name="plus" size={18} />Start a new quest</Link>} />
    <div className="quest-toolbar"><div className="journey-tabs" aria-label="Filter quests">{[{ id: 'all', label: 'All quests' }, { id: 'owner', label: 'I’m hosting' }, { id: 'member', label: 'I’ve joined' }].map(({ id, label }) => <button type="button" key={id} className={tab === id ? 'active' : ''} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}<span>{quests.filter((quest) => id === 'all' || quest.role === id).length}</span></button>)}</div><label className="journey-search-input"><Icon name="search" size={18} /><input aria-label="Search your quests" placeholder="Find a quest…" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
    {loading ? <LoadingState label="Opening the plans your people are shaping…" /> : error ? <ErrorState message={error} retry={retry} /> : visible.length ? <div className="journey-quest-grid">{visible.map((quest, index) => <QuestCard key={quest.id} quest={quest} index={index} />)}<Link to="/travel-dna/new" className="new-quest-tile"><TravelArtwork motif="luggage" className="new-quest-art" /><h2>Room for one more story.</h2><p>A weekend away. A long-awaited reunion.<br />The trip you keep talking about.</p><strong>Start something good <Icon size={17} /></strong></Link></div> : quests.length ? <EmptyState title="No quests here just yet." description={query ? 'Try another name or destination.' : 'An invitation from your people will open a new shared plan here.'} /> : <EmptyState title="The best trips need a few more voices." description="Invite your people to help shape this quest, or begin with a name." to="/travel-dna/new" label="Create your first quest" />}
  </section>
}
