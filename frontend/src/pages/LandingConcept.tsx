import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { exploreItineraries, type ExploreItinerary } from '../data/exploreItineraries'
import { getScoredItineraries } from '../services/recommendationEngine'
import { demoTravellers } from '../data/groupMockData'
import coast from '../assets/coast-hero.png'
import bali from '../assets/landing/bali.jpg'
import kyoto from '../assets/landing/kyoto.jpg'
import mountains from '../assets/landing/mountains.jpg'
import kerala from '../assets/landing/kerala.jpg'
import '../css/LandingConcept.css'

const photos: Record<string, string> = { amalfi: coast, bali, kyoto, interlaken: mountains, kerala }
const collection = ['amalfi', 'bali', 'kyoto', 'interlaken', 'kerala'].map((id) => exploreItineraries.find((trip) => trip.id === id)!)
const scenes = [
  { image: coast, name: 'The coastal chapter', detail: 'Salt in the air. Nowhere to rush.', destination: 'Amalfi Coast', tag: 'Slow mornings. Long dinners.', number: '01', trip: collection[0] },
  { image: mountains, name: 'The alpine chapter', detail: 'A little altitude. A new perspective.', destination: 'Into the mountains', tag: 'Fresh air. Wide-open possibilities.', number: '02', trip: collection[3] },
  { image: kyoto, name: 'The Kyoto chapter', detail: 'Take the long way through the city.', destination: 'A different kind of discovery', tag: 'Quiet streets. Shared discoveries.', number: '03', trip: collection[2] },
]
const moods = [
  { label: 'A little of everything', value: 'All', icon: 'spark' },
  { label: 'Slow & sunny', value: 'Relaxation', icon: 'sun' },
  { label: 'Into the wild', value: 'Adventure', icon: 'mountain' },
  { label: 'Culture & good food', value: 'Food & Culture', icon: 'compass' },
] as const

function Icon({ name = 'arrow', className = '' }: { name?: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
    northeast: <><path d="M5 19 19 5M5 5h14v14" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    mountain: <><path d="m2 19 7-13 5 8 3-5 5 10H2Zm4-7 3 2 3-3" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-3 5-5 3 3-5 5-3Z" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" /></>,
    spark: <><path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  }
  return <svg className={`gt-icon ${className}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.arrow}</svg>
}

function Brand() {
  return <><span className="gt-brand-symbol" aria-hidden="true"><i /><i /></span><span>Go<span className="gt-brand-dot">.</span>Together</span></>
}

function TripPreview({ trip, onClose, appBase }: { trip: ExploreItinerary | null; onClose: () => void; appBase: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!trip) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    dialog.current?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [trip])
  return <dialog className="gt-trip-dialog" ref={dialog} aria-labelledby="gt-trip-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    {trip && <div className="gt-dialog-content">
      <div className="gt-dialog-image"><img src={photos[trip.id]} alt={`${trip.destination} travel inspiration`} /><button className="gt-close" type="button" aria-label="Close trip preview" onClick={onClose} autoFocus><Icon name="close" /></button><span>{trip.country} / {trip.duration}</span></div>
      <div className="gt-dialog-copy"><p className="gt-eyebrow">A little inspiration for your next chapter</p><h2 id="gt-trip-title">{trip.destination}</h2><p>{trip.shortDescription}</p><div className="gt-trip-tags">{trip.moods.map((mood) => <span key={mood}>{mood}</span>)}</div><h3>A rhythm worth sharing</h3><p>{trip.whyItFits}</p><dl><div><dt>Time to explore</dt><dd>{trip.duration}</dd></div><div><dt>Budget style</dt><dd>{trip.budget}</dd></div><div><dt>Best seasons</dt><dd>{trip.seasons.join(' · ')}</dd></div></dl><p className="gt-preview-note">An itinerary idea to explore with your crew. Your own preferences will shape the final plan.</p><a className="gt-button gt-button-dark" href={`${appBase}/plan`}>Start planning a quest <Icon /></a></div>
    </div>}
  </dialog>
}

export function LandingConcept({ appBase = '' }: { appBase?: string }) {
  const root = useRef<HTMLDivElement>(null)
  const hero = useRef<HTMLElement>(null)
  const [scene, setScene] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mood, setMood] = useState('All')
  const [selectedTrip, setSelectedTrip] = useState<ExploreItinerary | null>(null)
  const [travelMood, setTravelMood] = useState('Relaxation')
  const [budget, setBudget] = useState('Moderate')
  const currentScene = scenes[scene]
  const filteredTrips = collection.filter((trip) => mood === 'All' || trip.moods.includes(mood)).slice(0, 3)
  const crew = useMemo(() => [...demoTravellers.slice(0, 2), { ...demoTravellers[2], name: 'You', initials: 'Y', moods: [travelMood], budget }], [travelMood, budget])
  const match = useMemo(() => { const ranked = getScoredItineraries(crew).find((trip) => Boolean(photos[trip.id]))!; return { ...exploreItineraries.find((trip) => trip.id === ranked.id)!, finalScore: ranked.score } }, [crew])

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Go.Together — The world feels better shared'
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const elements = root.current?.querySelectorAll('.gt-reveal')
    const observer = !media.matches && 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('gt-visible'); observer?.unobserve(entry.target) } })
    }, { threshold: 0.08 }) : null
    if (observer) { root.current?.classList.add('gt-motion-ready'); elements?.forEach((element) => observer.observe(element)) }
    return () => { observer?.disconnect(); document.title = previousTitle }
  }, [])

  return <div className="gt-concept" ref={root}>
    <a className="gt-skip" href="#gt-content">Skip to content</a>
    <header className="gt-nav">
      <a className="gt-brand" href={`${appBase}/`} aria-label="GoTogether home"><Brand /></a>
      <nav className="gt-desktop-links" aria-label="Landing page navigation"><a href="#gt-discover">Find your somewhere</a><a href="#gt-how">How it works</a><a href="#gt-dna">Travel DNA <span>✧</span></a></nav>
      <div className="gt-nav-actions"><a className="gt-login" href={`${appBase}/login`}>Log in</a><a className="gt-nav-cta" href={`${appBase}/plan`}>Start a quest <Icon name="northeast" /></a><button className="gt-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="gt-mobile-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <Icon name="close" /> : <span><i /><i /></span>}</button></div>
      {menuOpen && <nav className="gt-mobile-menu" id="gt-mobile-menu" aria-label="Mobile navigation" onKeyDown={(event) => { if (event.key === 'Escape') { setMenuOpen(false); root.current?.querySelector<HTMLButtonElement>('.gt-menu-toggle')?.focus() } }}><a href="#gt-discover" onClick={() => setMenuOpen(false)}>Find your somewhere <Icon /></a><a href="#gt-how" onClick={() => setMenuOpen(false)}>How it works <Icon /></a><a href="#gt-dna" onClick={() => setMenuOpen(false)}>Try Travel DNA <Icon /></a><a href={`${appBase}/login`}>Log in <Icon /></a></nav>}
    </header>

    <section className="gt-hero" ref={hero} aria-labelledby="gt-hero-title" onPointerMove={(event) => {
      if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const rect = event.currentTarget.getBoundingClientRect()
      hero.current?.style.setProperty('--gt-pointer-x', `${((event.clientX - rect.left) / rect.width - .5) * 10}px`)
      hero.current?.style.setProperty('--gt-pointer-y', `${((event.clientY - rect.top) / rect.height - .5) * 6}px`)
    }} onPointerLeave={() => { hero.current?.style.setProperty('--gt-pointer-x', '0px'); hero.current?.style.setProperty('--gt-pointer-y', '0px') }}>
      <div className="gt-hero-photos" aria-hidden="true">{scenes.map((item, index) => <img key={item.name} src={item.image} className={scene === index ? 'is-active' : ''} alt="" fetchPriority={index === 0 ? 'high' : 'auto'} />)}</div>
      <div className="gt-hero-shade" />
      <div className="gt-hero-copy" id="gt-content"><p className="gt-hero-kicker"><span /> FOR THE PLACES. AND THE PEOPLE.</p><h1 id="gt-hero-title">The world feels<br />better <em>shared.</em></h1><p className="gt-hero-description">Different people. One unforgettable trip.<br />Find your common ground, then go somewhere good.</p><div className="gt-hero-actions"><a className="gt-button gt-button-coral" href={`${appBase}/plan`}>Plan something together <Icon name="northeast" /></a><a className="gt-hero-secondary" href="#gt-how"><span>↓</span> See how it works</a></div><div className="gt-hero-note"><span className="gt-mini-crew" aria-hidden="true"><i>A</i><i>M</i><i>Y</i></span><span>For your people.<br /><strong>And all their different travel styles.</strong></span></div></div>

      <div className="gt-floating-wrap"><svg className="gt-flight-path" viewBox="0 0 480 270" fill="none" aria-hidden="true"><path d="M0 220C130 290 170 120 115 140S180 250 310 112 423 72 452 36" stroke="currentColor" strokeWidth="1.2" strokeDasharray="5 7" /><path d="m440 35 23-8-10 23-3-12-10-3Z" stroke="currentColor" strokeWidth="1.5" /></svg><button className="gt-floating-card" type="button" onClick={() => setSelectedTrip(currentScene.trip)} aria-label={`Preview ${currentScene.trip.destination}`}><span className="gt-floating-top"><Icon name="sun" /><span>A LITTLE LESS “SOMEDAY”</span><Icon name="northeast" /></span><strong>{currentScene.destination}</strong><span className="gt-floating-caption">{currentScene.tag}</span><span className="gt-floating-line" /><span className="gt-floating-bottom"><span className="gt-mini-crew" aria-hidden="true"><i>A</i><i>M</i><i>Y</i></span><span>Your next chapter awaits <b>↗</b></span></span></button><span className="gt-handwritten">wish we were here.</span></div>

      <div className="gt-hero-bottom"><div className="gt-scene-caption" aria-live="polite"><Icon name="pin" /><div><strong>{currentScene.name}</strong><span>{currentScene.detail}</span></div></div><div className="gt-scene-controls" aria-label="Choose a landscape">{scenes.map((item, index) => <button key={item.name} type="button" className={scene === index ? 'is-active' : ''} aria-label={`Show ${item.name}`} aria-pressed={scene === index} onClick={() => setScene(index)}><span>{item.number}</span><i /></button>)}</div><a href="#gt-discover" className="gt-scroll-link">A WORLD OF POSSIBILITIES <span>↓</span></a></div>
    </section>

    <div className="gt-belief-strip"><span>Less back-and-forth.</span><Icon name="spark" /><span>More “remember when?”</span><span className="gt-strip-detail">A shared plan for every kind of traveller.</span></div>

    <section className="gt-discover gt-section" id="gt-discover" aria-labelledby="gt-discover-title">
      <div className="gt-section-heading gt-reveal"><div><p className="gt-eyebrow"><span /> THE WORLD IS STILL FULL OF FIRSTS</p><h2 id="gt-discover-title">Find your kind<br />of <em>somewhere.</em></h2></div><div className="gt-heading-aside"><p>A long lunch. A wrong turn. A view that makes<br className="gt-desktop-break" /> everyone put their phone down.</p><a className="gt-text-link" href={`${appBase}/explore`}>Explore all itineraries <Icon name="northeast" /></a></div></div>
      <div className="gt-filter-row" aria-label="Filter destinations by travel style">{moods.map((item) => <button className={mood === item.value ? 'is-active' : ''} key={item.value} type="button" aria-pressed={mood === item.value} onClick={() => setMood(item.value)}><Icon name={item.icon} />{item.label}</button>)}</div>
      <p className="gt-sr-only" role="status">{filteredTrips.length} destination ideas for {moods.find((item) => item.value === mood)?.label}</p>
      <div className="gt-destination-grid">{filteredTrips.map((trip, index) => <article className="gt-destination" key={trip.id} style={{ '--gt-card-delay': `${index * 60}ms` } as CSSProperties}><button className="gt-destination-image" type="button" onClick={() => setSelectedTrip(trip)} aria-label={`Explore ${trip.destination}`}><img src={photos[trip.id]} alt={trip.id === 'interlaken' ? 'A sunlit alpine valley, inspiration for a mountain escape' : `${trip.destination}, ${trip.country}`} loading="lazy" /><span className="gt-country">{trip.country}</span><span className="gt-destination-open"><Icon name="northeast" /></span><span className="gt-image-caption">{trip.id === 'amalfi' ? 'For the slow-living souls' : trip.id === 'bali' ? 'For a breath of something new' : trip.id === 'kyoto' ? 'For the endlessly curious' : trip.id === 'interlaken' ? 'For the path less travelled' : 'For the art of slowing down'}</span></button><div className="gt-destination-meta"><h3><button type="button" onClick={() => setSelectedTrip(trip)}>{trip.destination}</button></h3><span>{trip.duration} <i>·</i> {trip.budget}</span></div><p>{trip.shortDescription}</p><div className="gt-trip-tags">{trip.moods.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div></article>)}</div>
      <div className="gt-discover-foot"><span><Icon name="compass" /> Inspiration first. The plan comes together with your people.</span><a href="#gt-dna">Find what fits your crew <Icon /></a></div>
    </section>

    <section className="gt-how gt-section" id="gt-how" aria-labelledby="gt-how-title"><div className="gt-section-heading gt-reveal"><div><p className="gt-eyebrow"><span /> FROM THE GROUP CHAT TO THE GATE</p><h2 id="gt-how-title">Big memories.<br /><em>Small first steps.</em></h2></div><p className="gt-how-intro">You bring the people.<br />We help you find the way.</p></div><div className="gt-steps gt-reveal"><article><span className="gt-step-number">01 <Icon name="compass" /></span><h3>Start with a “what if?”</h3><p>Name your quest and bring your crew into the picture. A weekend away or the trip you keep talking about.</p><span className="gt-step-tag">One place to begin</span></article><article><span className="gt-step-number">02 <Icon name="people" /></span><h3>Find your common ground.</h3><p>Budgets, must-dos, lazy mornings. Everyone shares what matters, and your shared Travel DNA takes shape.</p><span className="gt-step-tag">Every voice gets a say</span></article><article><span className="gt-step-number">03 <Icon name="sun" /></span><h3>Make it your kind of trip.</h3><p>Explore your best shared fit, a fair compromise, or something unexpected. Choose your direction together.</p><span className="gt-step-tag">A plan that feels like you</span></article></div></section>

    <section className="gt-dna" id="gt-dna" aria-labelledby="gt-dna-title"><div className="gt-dna-inner"><div className="gt-dna-copy gt-reveal"><p className="gt-eyebrow"><span /> DIFFERENT BY NATURE. BETTER TOGETHER.</p><h2 id="gt-dna-title">Your people.<br />Your rhythm.<br /><em>Your Travel DNA.</em></h2><p>There’s the sunrise hiker. The “one more café” friend. And the one who just needs a beach.</p><p>A great trip makes room for all of them. Travel DNA finds the overlap, so the plan feels good for everyone.</p><a className="gt-text-link" href={`${appBase}/travel-dna/new`}>Find our travel direction <Icon name="northeast" /></a><span className="gt-dna-footnote"><Icon name="check" /> Shared interests. Clear trade-offs. Room for everyone.</span></div>
      <div className="gt-dna-demo gt-reveal"><div className="gt-demo-heading"><span><i /> THE COMMON GROUND</span><span>INTERACTIVE PREVIEW</span></div><div className="gt-demo-crew"><div><span className="gt-person aisha">A</span><strong>Aisha</strong><small>Food & nature</small></div><span className="gt-crew-plus">+</span><div><span className="gt-person maya">M</span><strong>Maya</strong><small>Rest & recharge</small></div><span className="gt-crew-plus">+</span><div><span className="gt-person you">Y</span><strong>You</strong><small>{travelMood === 'Food & Culture' ? 'Local discoveries' : travelMood === 'Adventure' ? 'A little adventure' : 'A slower rhythm'}</small></div></div><fieldset className="gt-mood-picker"><legend>What’s your kind of good day?</legend>{[{ label: 'Slow & easy', value: 'Relaxation', icon: 'sun' }, { label: 'Out exploring', value: 'Adventure', icon: 'mountain' }, { label: 'Local flavours', value: 'Food & Culture', icon: 'compass' }].map((item) => <button type="button" key={item.value} aria-pressed={travelMood === item.value} className={travelMood === item.value ? 'is-active' : ''} onClick={() => setTravelMood(item.value)}><Icon name={item.icon} />{item.label}</button>)}</fieldset><div className="gt-budget-control"><label htmlFor="gt-budget">And your budget style?</label><select id="gt-budget" value={budget} onChange={(event) => setBudget(event.target.value)}><option>Budget-friendly</option><option>Moderate</option><option>Premium</option></select></div><div className="gt-demo-connector" aria-hidden="true"><span /><Icon name="spark" /><span /></div><div className="gt-match" aria-live="polite"><img src={photos[match.id]} alt="" loading="lazy" /><div><span>A SHARED DIRECTION</span><h3>{match.destination}</h3><p>{match.duration} · {match.moods.slice(0, 2).join(' + ')}</p></div><button type="button" aria-label={`Preview matched trip to ${match.destination}`} onClick={() => setSelectedTrip(match)}><Icon name="northeast" /></button></div><div className="gt-fit-bar"><span style={{ width: `${match.finalScore}%` }} /></div><p className="gt-demo-note">Example crew · {match.finalScore}% group fit <span>Change your style. See what changes.</span></p></div>
    </div></section>

    <section className="gt-manifesto gt-section"><div className="gt-manifesto-label gt-reveal"><Icon name="spark" /><p>THE GOOD PART<br />IS THE TOGETHER PART.</p></div><div className="gt-reveal"><h2>Years from now, you won’t<br className="gt-desktop-break" /> remember the planning.<br />You’ll remember <em>being there.</em></h2><p>The missed turn that became the best afternoon.<br />The table that somehow fit everyone. The people beside you.</p><a className="gt-button gt-button-dark" href={`${appBase}/plan`}>Let’s make a memory <Icon name="northeast" /></a></div><div className="gt-postcard gt-reveal"><img src={coast} alt="A quiet cove and sunlit coastal village" loading="lazy" /><span>Meet you somewhere good. <i>♡</i></span><div className="gt-postcard-stamp"><Icon name="sun" /><small>GO<br />TOGETHER</small></div></div></section>

    <section className="gt-faq gt-section" aria-labelledby="gt-faq-title"><div><p className="gt-eyebrow"><span /> BEFORE YOU GO</p><h2 id="gt-faq-title">A little<br /><em>good to know.</em></h2></div><div className="gt-faq-list"><details><summary>What exactly is a quest?<span>+</span></summary><p>A quest is your trip’s shared starting point: a name, your crew, and the preferences that matter. From there, you can explore destinations and compare directions together.</p></details><details><summary>Do we need to know where we’re going?<span>+</span></summary><p>No destination required. Start with how you want the trip to feel, your budget, and your must-haves. Use the itinerary collection for inspiration along the way.</p></details><details><summary>What if we all want different things?<span>+</span></summary><p>That’s where Travel DNA helps. Compare your best shared fit, a fair compromise that considers each traveller, and an unexpected discovery. Each direction includes its trade-off.</p></details><details><summary>Can I book flights and hotels here?<span>+</span></summary><p>GoTogether currently focuses on preferences, inspiration, and planning. Booking and payment are not part of this experience.</p></details></div></section>

    <footer className="gt-footer"><div className="gt-footer-top"><a className="gt-brand" href={`${appBase}/`} aria-label="GoTogether home"><Brand /></a><p>Good places. Better company.</p><a href="#gt-content">Back to the beginning <span>↑</span></a></div><div className="gt-footer-wordmark" aria-hidden="true">Go.Together<span>✳</span></div><div className="gt-footer-bottom"><span>Made for a world worth sharing.</span><span>A landing-page concept · GoTogether</span><a href={`${appBase}/explore`}>Your next chapter <Icon name="northeast" /></a></div></footer>
    {selectedTrip && <TripPreview trip={selectedTrip} onClose={() => setSelectedTrip(null)} appBase={appBase} />}
  </div>
}
