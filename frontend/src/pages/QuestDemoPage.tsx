import { useEffect, useState } from 'react'
import { getDemo, enterDemo, type QuestDemo } from '../services/questDemo'
import '../styles/quest-demo.css'

export function QuestDemoPage() {
  const [demo, setDemo] = useState<QuestDemo | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { getDemo().then(setDemo).catch(reason => setError(reason.message)) }, [])
  const open = async (actor: string, scene: string) => {
    const chosen = demo?.scenes.find(item => item.key === scene)
    if (!chosen) return
    setBusy(true); setError('')
    try { await enterDemo(actor, chosen) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open the demo.'); setBusy(false) }
  }
  return <div className="quest-demo">
    <header className="demo-hero">
      <img src="/photos/places/thailand-wat-arun.webp" alt="Wat Arun beside the river in Bangkok" fetchPriority="high" />
      <div><p className="eyebrow">A WORKING GO.TOGETHER DEMO</p><h1>Four friends.<br />One Bangkok story.</h1><p>A temple lover, a budget keeper, a café wanderer and the friend who brings them together.</p><span>14–17 January 2027 · 4 travellers · 4 days</span><button className="primary-button" disabled={busy || !demo} onClick={() => void open('aarav', 'ready')}>Explore the agreed trip <span aria-hidden="true">↗</span></button></div>
    </header>
    <div className="demo-note"><strong>Fictional crew. Working trip.</strong><p>These prepared scenes use the real planner. Responses, edits and chat save to the local database. Use the traveller switcher to experience every side of a group decision. Exit demo restores your previous account.</p></div>
    {error && <p className="demo-error" role="alert">{error}</p>}
    {!demo && !error && <p role="status">Opening the Bangkok demo…</p>}
    {demo && <>
      <section aria-labelledby="demo-scenes"><div className="demo-section-heading"><p className="eyebrow">PICK UP THE STORY ANYWHERE</p><h2 id="demo-scenes">From “who’s in?” to <em>“let’s go.”</em></h2><p>Four independent saved rooms. Make changes freely; switching stages keeps your work in each room.</p></div><div className="demo-scenes">{demo.scenes.map((scene, index) => <article key={scene.key}><span className="demo-step">0{index + 1}</span><h3>{scene.name}</h3><p>{scene.description}</p><ol>{scene.guide.map(step => <li key={step}>{step}</li>)}</ol><button className="secondary-button" disabled={busy} onClick={() => void open(scene.key === 'gather' ? 'riya' : 'aarav', scene.key)}>Enter as {scene.key === 'gather' ? 'Riya' : 'Aarav'} <span aria-hidden="true">↗</span></button></article>)}</div></section>
      <section aria-labelledby="demo-people"><div className="demo-section-heading"><p className="eyebrow">EVERY VOICE CHANGES THE PLAN</p><h2 id="demo-people">Meet your <em>Bangkok crew.</em></h2></div><div className="demo-people">{demo.actors.map(actor => <article key={actor.key}><header><span className="demo-avatar" style={{ background: actor.color }} aria-hidden="true">{actor.firstName[0]}{actor.lastName[0]}</span><div><h3>{actor.firstName} {actor.lastName}</h3><span>{actor.role} · {actor.city}</span></div></header><p>{actor.story}</p><div className="demo-moods">{actor.moods.map(mood => <span key={mood}>{mood}</span>)}</div><dl><div><dt>Pace</dt><dd>{actor.pace}</dd></div><div><dt>Ideal start</dt><dd>{actor.start}</dd></div><div><dt>Must-have</dt><dd>{actor.must}</dd></div></dl><button className="secondary-button" disabled={busy} onClick={() => void open(actor.key, 'compare')}>Explore as {actor.firstName} <span aria-hidden="true">↗</span></button></article>)}</div></section>
      <aside className="demo-footnote"><h2>A demo you can actually use.</h2><p>Try preferences, option votes, final agreement, saved ideas, crew chat, itinerary editing, locks, undo, activity confirmations and Travel Style. Each traveller has a fictional past trip, confirmed interests, points and planning credits.</p><p>The three starting itineraries are prepared examples ranked against the crew’s preferences. AI Companion uses the configured provider when you ask it; generated results can vary. Flights and neighbourhood stays are indicative searches on Booking.com, with no tickets or rooms reserved.</p><p>Place references: <a href="https://www.royalgrandpalace.th/en/visit/faq" target="_blank" rel="noreferrer">Grand Palace visitor information ↗</a> · <a href="https://www.tourismthailand.org/Shop/chatuchak-market" target="_blank" rel="noreferrer">Chatuchak Market ↗</a>. Confirm current hours, transport and prices before travelling.</p></aside>
    </>}
  </div>
}
