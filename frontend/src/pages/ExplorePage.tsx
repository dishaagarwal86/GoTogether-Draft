import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useSavedTrips } from '../services/journeyStorage'
import { PageHeading, EmptyState } from '../components/Ui'
import mountains from '../assets/landing/mountains.jpg'
import { ExploreItineraryCard } from '../components/ExploreItineraryCard'
import { ItineraryDrawer } from '../components/ItineraryDrawer'
import { exploreItineraries, type ExploreItinerary } from '../data/exploreItineraries'
import { createQuestPick } from '../apis/quests'
import { fetchCatalogue } from '../apis/catalogue'

const filterOptions = {
  Mood: ['Adventure', 'Food & Culture', 'Relaxation', 'Nature', 'Nightlife', 'Wellness'],
  Location: ['Beach', 'Mountains', 'City', 'Countryside', 'Islands', 'Hidden gems'],
  Budget: ['Budget-friendly', 'Moderate', 'Premium'],
  Season: ['Spring', 'Summer', 'Autumn', 'Winter'],
}
type FilterName = keyof typeof filterOptions

export function ExplorePage({ savedOnly = false }: { savedOnly?: boolean }) {
  const [params] = useSearchParams()
  const roomId = params.get('roomId')
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)
  const { saved, toggle: toggleSaved } = useSavedTrips()
  const [itineraries, setItineraries] = useState<ExploreItinerary[]>([])
  const [loading, setLoading] = useState(true)
  const [moods, setMoods] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [budget, setBudget] = useState('')
  const [season, setSeason] = useState('')
  const [openFilter, setOpenFilter] = useState<FilterName | null>(null)
  const [selected, setSelected] = useState<ExploreItinerary | null>(null)
  const [notice, setNotice] = useState('')
  const [catalogueNotice, setCatalogueNotice] = useState('')
  const placeId = params.get('place')

  useEffect(() => {
    let active = true
    fetchCatalogue().then((data) => {
      if (!active) return
      // Preserve links and saved IDs from the original inspiration collection.
      const collection = [...data, ...exploreItineraries.filter(item => !data.some(trip => trip.id === item.id))]
      setItineraries(collection)
      if (placeId) setSelected(collection.find(item => item.id === placeId) ?? null)
      setCatalogueNotice('')
    }).catch(() => {
      if (!active) return
      setItineraries(exploreItineraries)
      if (placeId) setSelected(exploreItineraries.find(item => item.id === placeId) ?? null)
      setCatalogueNotice('Showing the inspiration collection while live itineraries are unavailable.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [placeId])

  const toggle = (value: string, current: string[], setCurrent: (next: string[]) => void) => setCurrent(current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  const activeCount = moods.length + locations.length + Number(Boolean(budget)) + Number(Boolean(season))
  const filtered = useMemo(() => itineraries.filter((item) => (!savedOnly || saved.includes(item.id)) && (!moods.length || moods.some((mood) => item.moods.includes(mood))) && (!locations.length || locations.includes(item.locationType)) && (!budget || item.budget === budget) && (!season || item.seasons.includes(season))), [itineraries, moods, locations, budget, season, savedOnly, saved])
  const results = activeCount > 0 || savedOnly || showAll ? filtered : filtered.slice(0, 12)
  const resultHeading = moods.length || season ? `${moods.length ? `${moods.map((item) => item.toLowerCase()).join(' and ')} quests` : 'Quests'}${season ? ` for ${season.toLowerCase()}` : ''}` : savedOnly ? 'Places for your someday list' : 'The itinerary collection'
  const reset = () => { setMoods([]); setLocations([]); setBudget(''); setSeason(''); setOpenFilter(null) }
  const useInspiration = (itinerary: ExploreItinerary) => { if (!saved.includes(itinerary.id)) toggleSaved(itinerary.id); setNotice(`${itinerary.destination} is saved to your collection in this browser.`); setSelected(null); window.setTimeout(() => setNotice(''), 3500) }

  const saveToRoom = roomId ? async (itinerary: ExploreItinerary) => {
    await createQuestPick(roomId, { type: 'itinerary', title: itinerary.title, destination: `${itinerary.destination}, ${itinerary.country}`, note: itinerary.shortDescription, link: new URL(`/explore?${new URLSearchParams({ place: itinerary.id, roomId })}`, window.location.origin).href })
    navigate(`/quests/${encodeURIComponent(roomId)}?tab=ideas`)
  } : undefined

  return <section className="explore-page">
    {roomId && <p><Link className="back-link" to={`/quests/${encodeURIComponent(roomId)}?tab=options`}>← Back to your crew’s options</Link></p>}
    {savedOnly ? <><PageHeading eyebrow="FOR YOUR SOMEDAY LIST" title={<>Places that made<br />you <em>pause.</em></>} description="Keep a little inspiration for the next time someone says, 'we should go somewhere.'" /><p className="saved-collection-note">Your collection is saved for this account in this browser.</p></> : <header className="explore-hero"><img src={mountains} alt="A sweeping alpine valley at golden hour" /><div className="explore-hero-overlay" /><div className="explore-hero-copy"><p className="eyebrow">THE WORLD IS STILL FULL OF FIRSTS</p><h1>Find your kind<br />of <em>somewhere.</em></h1><p>A little inspiration. A whole world of possibility.</p></div></header>}
    {savedOnly && !saved.length && <EmptyState title="Keep a little wanderlust close." description="Tap the heart on any itinerary to save it here. Your next great idea might be one scroll away." to="/explore" label="Find some inspiration" icon="heart" />}

    {catalogueNotice && <p className="saved-collection-note" role="status">{catalogueNotice}</p>}
    <section className="explore-filter-wrap" aria-label="Itinerary filters"><div className="explore-filters"><div className="filter-title"><span>Filter itineraries</span>{activeCount > 0 && <b>{activeCount} active</b>}</div>{(Object.keys(filterOptions) as FilterName[]).map((name) => <div className="filter-menu" key={name}><button className={openFilter === name ? 'filter-trigger is-open' : 'filter-trigger'} type="button" onClick={() => setOpenFilter(openFilter === name ? null : name)} aria-expanded={openFilter === name}>{name}<span>{name === 'Mood' ? moods.length : name === 'Location' ? locations.length : name === 'Budget' ? budget : season} ⌄</span></button>{openFilter === name && <div className="filter-options">{filterOptions[name].map((option) => { const isActive = name === 'Mood' ? moods.includes(option) : name === 'Location' ? locations.includes(option) : name === 'Budget' ? budget === option : season === option; return <button className={isActive ? 'is-active' : ''} type="button" key={option} aria-pressed={isActive} onClick={() => name === 'Mood' ? toggle(option, moods, setMoods) : name === 'Location' ? toggle(option, locations, setLocations) : name === 'Budget' ? setBudget(budget === option ? '' : option) : setSeason(season === option ? '' : option)}>{option}{isActive && <span>✓</span>}</button> })}</div>}</div>)}<button className="reset-filters" type="button" onClick={reset} disabled={!activeCount}>Reset filters</button></div></section>
    <section className="explore-results"><div className="explore-results-heading"><div><p className="eyebrow">{loading ? 'Loading quests…' : 'PLACES, POSSIBILITIES, YOUR NEXT CHAPTER'}</p><h2>{resultHeading}</h2></div><p>{filtered.length} itineraries to explore. Your room compares them with everyone’s preferences.</p></div>{results.length ? <div className="explore-grid">{results.map((itinerary) => <ExploreItineraryCard key={itinerary.id} itinerary={itinerary} saved={saved.includes(itinerary.id)} onSave={() => toggleSaved(itinerary.id)} onView={() => setSelected(itinerary)} />)}</div> : <div className="no-results" hidden={savedOnly && !saved.length}><span>✦</span><h2>No close matches yet.</h2><p>Try opening up a filter or two—we have more beautiful directions to explore.</p><button type="button" onClick={reset}>Reset filters</button></div>}</section>
    {results.length < filtered.length && <div className="explore-show-all"><p>Showing {results.length} of {filtered.length} itineraries</p><button className="secondary-button" onClick={() => setShowAll(true)}>Show all {filtered.length} itineraries</button></div>}
    <ItineraryDrawer onAddToRoom={saveToRoom} itinerary={selected} onClose={() => setSelected(null)} onUse={useInspiration} />
    {notice && <div className="explore-toast" role="status">✦ {notice}</div>}
  </section>
}
