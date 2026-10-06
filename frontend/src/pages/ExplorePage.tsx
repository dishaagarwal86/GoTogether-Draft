import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSavedTrips } from '../services/journeyStorage'
import { PageHeading, EmptyState } from '../components/Ui'
import mountains from '../assets/landing/mountains.jpg'
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

export function ExplorePage({ savedOnly = false }: { savedOnly?: boolean }) {
  const [params] = useSearchParams()
  const { saved, toggle: toggleSaved } = useSavedTrips()
  const [moods, setMoods] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [budget, setBudget] = useState('')
  const [season, setSeason] = useState('')
  const [openFilter, setOpenFilter] = useState<FilterName | null>(null)
  const [selected, setSelected] = useState<ExploreItinerary | null>(() => exploreItineraries.find((trip) => trip.id === params.get('place')) ?? null)
  const [notice, setNotice] = useState('')
  const toggle = (value: string, current: string[], setCurrent: (next: string[]) => void) => setCurrent(current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  const activeCount = moods.length + locations.length + Number(Boolean(budget)) + Number(Boolean(season))
  const results = useMemo(() => exploreItineraries.filter((item) => (!savedOnly || saved.includes(item.id)) && (!moods.length || moods.some((mood) => item.moods.includes(mood))) && (!locations.length || locations.includes(item.locationType)) && (!budget || item.budget === budget) && (!season || item.seasons.includes(season))), [moods, locations, budget, season, savedOnly, saved])
  const resultHeading = moods.length || season ? `${moods.length ? `${moods.map((item) => item.toLowerCase()).join(' and ')} quests` : 'Quests'}${season ? ` for ${season.toLowerCase()}` : ''}` : savedOnly ? 'Places for your someday list' : 'Somewhere worth going'
  const reset = () => { setMoods([]); setLocations([]); setBudget(''); setSeason(''); setOpenFilter(null) }
  const useInspiration = (itinerary: ExploreItinerary) => { if (!saved.includes(itinerary.id)) toggleSaved(itinerary.id); setNotice(`${itinerary.destination} is saved to your collection in this browser.`); setSelected(null); window.setTimeout(() => setNotice(''), 3500) }

  return <section className="explore-page">
    {savedOnly ? <><PageHeading eyebrow="FOR YOUR SOMEDAY LIST" title={<>Places that made<br />you <em>pause.</em></>} description="Keep a little inspiration for the next time someone says, ‘we should go somewhere.’" /><p className="saved-collection-note">Your collection is saved for this account in this browser.</p></> : <header className="explore-hero"><img src={mountains} alt="A sweeping alpine valley at golden hour" /><div className="explore-hero-overlay" /><div className="explore-hero-copy"><p className="eyebrow">THE WORLD IS STILL FULL OF FIRSTS</p><h1>Find your kind<br />of <em>somewhere.</em></h1><p>A little inspiration. A whole world of possibility.</p></div></header>}
    {savedOnly && !saved.length && <EmptyState title="Keep a little wanderlust close." description="Tap the heart on any itinerary to save it here. Your next great idea might be one scroll away." to="/explore" label="Find some inspiration" icon="heart" />}

    <section className="explore-filter-wrap" aria-label="Itinerary filters"><div className="explore-filters"><div className="filter-title"><span>Filter itineraries</span>{activeCount > 0 && <b>{activeCount} active</b>}</div>{(Object.keys(filterOptions) as FilterName[]).map((name) => <div className="filter-menu" key={name}><button className={openFilter === name ? 'filter-trigger is-open' : 'filter-trigger'} type="button" onClick={() => setOpenFilter(openFilter === name ? null : name)} aria-expanded={openFilter === name}>{name}<span>{name === 'Mood' ? moods.length : name === 'Location' ? locations.length : name === 'Budget' ? budget : season} ⌄</span></button>{openFilter === name && <div className="filter-options">{filterOptions[name].map((option) => { const isActive = name === 'Mood' ? moods.includes(option) : name === 'Location' ? locations.includes(option) : name === 'Budget' ? budget === option : season === option; return <button className={isActive ? 'is-active' : ''} type="button" key={option} aria-pressed={isActive} onClick={() => name === 'Mood' ? toggle(option, moods, setMoods) : name === 'Location' ? toggle(option, locations, setLocations) : name === 'Budget' ? setBudget(budget === option ? '' : option) : setSeason(season === option ? '' : option)}>{option}{isActive && <span>✓</span>}</button> })}</div>}</div>)}<button className="reset-filters" type="button" onClick={reset} disabled={!activeCount}>Reset filters</button></div></section>
    <section className="explore-results"><div className="explore-results-heading"><div><p className="eyebrow">{results.length} places to consider</p><h2>{resultHeading}</h2></div><p>Curated ideas to explore at your own pace.</p></div>{results.length ? <div className="explore-grid">{results.map((itinerary) => <ExploreItineraryCard key={itinerary.id} itinerary={itinerary} saved={saved.includes(itinerary.id)} onSave={() => toggleSaved(itinerary.id)} onView={() => setSelected(itinerary)} />)}</div> : <div className="no-results" hidden={savedOnly && !saved.length}><span>✦</span><h2>No close matches yet.</h2><p>Try opening up a filter or two—we have more beautiful directions to explore.</p><button type="button" onClick={reset}>Reset filters</button></div>}</section>
    <ItineraryDrawer itinerary={selected} onClose={() => setSelected(null)} onUse={useInspiration} />
    {notice && <div className="explore-toast" role="status">✦ {notice}</div>}
  </section>
}
