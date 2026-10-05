import { useMemo, useState } from 'react'
import { ExploreItineraryCard } from '../components/ExploreItineraryCard'
import { ItineraryDrawer } from '../components/ItineraryDrawer'
import { exploreItineraries, type ExploreItinerary } from '../data/exploreItineraries'

const filterOptions = {
  Mood: ['Adventure', 'Food & Culture', 'Relaxation', 'Nature', 'Nightlife', 'Wellness'],
  Location: ['Beach', 'Mountains', 'City', 'Countryside', 'Islands', 'Hidden gems'],
  Budget: ['Budget-friendly', 'Moderate', 'Premium'],
  Season: ['Spring', 'Summer', 'Autumn', 'Winter'],
}
type FilterName = keyof typeof filterOptions

export function ExplorePage() {
  const [moods, setMoods] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [budget, setBudget] = useState('')
  const [season, setSeason] = useState('')
  const [openFilter, setOpenFilter] = useState<FilterName | null>(null)
  const [saved, setSaved] = useState<string[]>([])
  const [selected, setSelected] = useState<ExploreItinerary | null>(null)
  const [notice, setNotice] = useState('')
  const toggle = (value: string, current: string[], setCurrent: (next: string[]) => void) => setCurrent(current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  const activeCount = moods.length + locations.length + Number(Boolean(budget)) + Number(Boolean(season))
  const results = useMemo(() => exploreItineraries.filter((item) => (!moods.length || moods.some((mood) => item.moods.includes(mood))) && (!locations.length || locations.includes(item.locationType)) && (!budget || item.budget === budget) && (!season || item.seasons.includes(season))), [moods, locations, budget, season])
  const resultHeading = moods.length || season ? `${moods.length ? `${moods.map((item) => item.toLowerCase()).join(' and ')} quests` : 'Quests'}${season ? ` for ${season.toLowerCase()}` : ''}` : 'Suggested quests for your crew'
  const reset = () => { setMoods([]); setLocations([]); setBudget(''); setSeason(''); setOpenFilter(null) }
  const useInspiration = (itinerary: ExploreItinerary) => { setNotice(`${itinerary.destination} is now your trip inspiration.`); setSelected(null); window.setTimeout(() => setNotice(''), 3500) }

  return <section className="explore-page">
    <header className="explore-hero"><div className="explore-orb orb-one" /><div className="explore-orb orb-two" /><img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1800&q=90" alt="A sweeping mountain valley at golden hour" /><div className="explore-hero-overlay" /><div className="explore-hero-copy"><span className="personalised-badge">✦ Personalised for your group</span><p className="eyebrow">Explore quests</p><h1>Find the quest that <em>feels like you.</em></h1><p>Curated itineraries shaped around your group’s shared style.</p></div></header>
    <section className="explore-filter-wrap" aria-label="Itinerary filters"><div className="explore-filters"><div className="filter-title"><span>Filter itineraries</span>{activeCount > 0 && <b>{activeCount} active</b>}</div>{(Object.keys(filterOptions) as FilterName[]).map((name) => <div className="filter-menu" key={name}><button className={openFilter === name ? 'filter-trigger is-open' : 'filter-trigger'} type="button" onClick={() => setOpenFilter(openFilter === name ? null : name)} aria-expanded={openFilter === name}>{name}<span>{name === 'Mood' ? moods.length : name === 'Location' ? locations.length : name === 'Budget' ? budget : season} ⌄</span></button>{openFilter === name && <div className="filter-options">{filterOptions[name].map((option) => { const isActive = name === 'Mood' ? moods.includes(option) : name === 'Location' ? locations.includes(option) : name === 'Budget' ? budget === option : season === option; return <button className={isActive ? 'is-active' : ''} type="button" key={option} aria-pressed={isActive} onClick={() => name === 'Mood' ? toggle(option, moods, setMoods) : name === 'Location' ? toggle(option, locations, setLocations) : name === 'Budget' ? setBudget(budget === option ? '' : option) : setSeason(season === option ? '' : option)}>{option}{isActive && <span>✓</span>}</button> })}</div>}</div>)}<button className="reset-filters" type="button" onClick={reset} disabled={!activeCount}>Reset filters</button></div></section>
    <section className="explore-results"><div className="explore-results-heading"><div><p className="eyebrow">{results.length} quests to consider</p><h2>{resultHeading}</h2></div><p>Thoughtfully matched to the things your group cares about.</p></div>{results.length ? <div className="explore-grid">{results.map((itinerary) => <ExploreItineraryCard key={itinerary.id} itinerary={itinerary} saved={saved.includes(itinerary.id)} onSave={() => setSaved((current) => current.includes(itinerary.id) ? current.filter((id) => id !== itinerary.id) : [...current, itinerary.id])} onView={() => setSelected(itinerary)} />)}</div> : <div className="no-results"><span>✦</span><h2>No close matches yet.</h2><p>Try opening up a filter or two—we have more beautiful directions to explore.</p><button type="button" onClick={reset}>Reset filters</button></div>}</section>
    <ItineraryDrawer itinerary={selected} onClose={() => setSelected(null)} onUse={useInspiration} />
    {notice && <div className="explore-toast" role="status">✦ {notice}</div>}
  </section>
}
