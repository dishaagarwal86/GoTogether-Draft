import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { activeDemo, enterDemo, exitDemo, getDemo, type QuestDemo } from '../services/questDemo'
import '../styles/quest-demo.css'

export function QuestDemoToolbar() {
  const [active] = useState(activeDemo)
  const [demo, setDemo] = useState<QuestDemo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const location = useLocation()
  useEffect(() => { if (active) getDemo().then(setDemo).catch(reason => setError(reason.message)) }, [active])
  if (!active) return null
  const actor = demo?.actors.find(person => person.key === active.actorKey)
  const scene = demo?.scenes.find(item => location.pathname === `/quests/${item.roomId}`) ?? demo?.scenes.find(item => item.key === active.sceneKey)
  const act = async (action: () => Promise<void>) => { setBusy(true); setError(''); try { await action() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the demo.'); setBusy(false) } }
  return <aside className="demo-toolbar" aria-label="Demo controls"><div className="demo-toolbar-main"><Link to="/demo">Bangkok demo <span>Fictional travellers · changes save</span></Link><label>Travelling as<select aria-label="Demo traveller" value={active.actorKey} disabled={busy || !demo} onChange={event => scene && void act(() => enterDemo(event.target.value, scene, true))}>{demo?.actors.map(person => <option key={person.key} value={person.key}>{person.firstName} · {person.role}</option>)}</select></label><label>Story stage<select aria-label="Demo story stage" value={scene?.key ?? active.sceneKey} disabled={busy || !demo} onChange={event => { const chosen = demo?.scenes.find(item => item.key === event.target.value); if (chosen) void act(() => enterDemo(active.actorKey, chosen)) }}>{demo?.scenes.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label><button disabled={busy} onClick={() => void act(exitDemo)}>Exit demo ↗</button></div>{error && <p role="alert">{error}</p>}{actor && scene && <details><summary>Presenter guide · {actor.firstName}’s perspective</summary><p>{actor.story}</p><ol>{scene.guide.map(step => <li key={step}>{step}</li>)}</ol><p>{actor.key === 'aarav' ? 'You are the host: edit the plan, invite people and manage the crew.' : 'You are a traveller: respond, chat and share ideas. Aarav hosts and edits the shared itinerary.'} Switch travellers to register each person’s response.</p></details>}</aside>
}
