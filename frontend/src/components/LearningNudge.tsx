import { useState } from 'react'
import { Link } from 'react-router-dom'
import { rememberEdit, type LearningPrompt } from '../services/travelMemoryApi'
import { Icon } from './Ui'

export function LearningNudge({ suggestion, onClose }: { suggestion: LearningPrompt; onClose: () => void }) {
  const [scope, setScope] = useState(suggestion.context)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const remember = async () => {
    if (busy) return
    setBusy(true); setError('')
    try { await rememberEdit(suggestion.eventId, scope); setSaved(true) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Please try again.') }
    finally { setBusy(false) }
  }
  return <aside className="memory-nudge" aria-label="Remember a travel preference"><span className="memory-nudge-icon"><Icon name="leaf" size={22} /></span><div><p className="canvas-kicker">{saved ? 'A LITTLE MORE YOU' : 'YOUR EDIT IS SAVED. ONE OPTIONAL THOUGHT…'}</p><strong>{saved ? 'Remembered for your future plans.' : `${suggestion.label}?`}</strong><p>{saved ? 'You can correct or forget this any time. Undoing the source edit removes its learning contribution.' : 'A lasting preference, or just today’s weather, timing, or crew? You decide.'}</p>{error && <p role="alert" className="form-error">{error}</p>}<div className="memory-nudge-actions">{saved ? <><Link to="/travel-style">See my travel style <Icon size={14} /></Link><button onClick={onClose}>Got it</button></> : <><label className="sr-only" htmlFor="memory-scope">Remember for</label><select id="memory-scope" value={scope} onChange={event => setScope(event.target.value)}><option value={suggestion.context}>{suggestion.context} trips</option><option value="any">All my trips</option></select><button className="memory-primary" disabled={busy} onClick={() => void remember()}>{busy ? 'Remembering…' : 'Remember this'}</button><button disabled={busy} onClick={onClose}>Just this trip</button></>}</div></div><button className="memory-dismiss" aria-label="Dismiss memory suggestion" onClick={onClose}><Icon name="close" size={16} /></button></aside>
}
