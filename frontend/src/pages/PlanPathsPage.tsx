import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { getPlanPaths, type PlanPath } from '../services/recommendationEngine'
import { askCompanion } from '../services/companionApi'

export function PlanPathsPage() {
  const navigate = useNavigate(); const [note, setNote] = useState(''); const [loading, setLoading] = useState<string | null>(null)
  const choose = async (path: PlanPath) => { setLoading(path.id); try { setNote((await askCompanion('explain', undefined, path)).summary) } catch { setNote('This path is ready to use as the starting point for your quest.') } finally { setLoading(null) } }
  return <section className="flow-page paths-page"><div className="flow-topbar"><Link className="back-link" to="/travel-dna/group-dna">← Group DNA</Link><span className="flow-step">Choose together</span></div><div className="flow-heading"><p className="eyebrow">Three ways forward</p><h1>Choose a path that feels <em>fair.</em></h1><p className="lede">These routes are calculated from the group’s real preferences—not from an AI guess.</p></div><div className="path-grid">{getPlanPaths().map((path) => <article className="path-card" key={path.id}><img src={path.itinerary.image} alt="" /><div><span className="path-label">{path.label}</span><p className="section-kicker">{path.title}</p><h2>{path.itinerary.title}</h2><p>{path.description}</p><small><b>Trade-off:</b> {path.tradeoff}</small><button className="text-button" type="button" onClick={() => choose(path)}>{loading === path.id ? 'Thinking…' : 'Why this works'} <span>→</span></button></div></article>)}</div>{note && <div className="path-note" role="status">✦ {note}<button type="button" onClick={() => navigate('/explore')}>Explore this direction</button></div>}</section>
}
