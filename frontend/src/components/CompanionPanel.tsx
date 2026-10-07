import { useEffect, useId, useState } from 'react'
import { applyCompanionSuggestion, askCompanion, companionHistory, sourceLabel, type CompanionReply } from '../services/companionApi'

const fieldNames: Record<string, string> = { moods: 'Travel interests', budget: 'Budget', pace: 'Pace', mustHave: 'Must-do', noGo: 'Things to skip', daysCount: 'Trip length (days)' }

export function CompanionPanel({ roomId, mode = 'extract', context }: { roomId: string; mode?: 'extract' | 'chat'; context?: { label: string; detail: string } | null }) {
  const inputId = useId()
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<CompanionReply[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [includeCrew, setIncludeCrew] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(true)
  useEffect(() => {
    let active = true
    companionHistory(mode, roomId).then(items => { if (active) { setHistory(items.reverse()); setError('') } }).catch(() => { if (active) setError('Saved Companion notes could not be loaded. Try loading them again.') }).finally(() => { if (active) setHistoryLoading(false) })
    return () => { active = false }
  }, [mode, roomId, revision])
  const latest = history.at(-1)
  const send = async () => {
    if (!message.trim() || loading) return
    setLoading(true); setError('')
    try {
      const question = context ? `About ${context.label}: ${context.detail.slice(0, 700)}\n\n${message.trim()}` : message.trim()
      const reply = await askCompanion({ task: mode, roomId, message: question.slice(0, 4000), includeCrew })
      setHistory(items => [...items, { ...reply, message: message.trim() }]); setSelected([]); setMessage('')
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.') } finally { setLoading(false) }
  }
  const apply = async () => {
    if (!latest || !selected.length || applying) return
    setApplying(true); setError('')
    try {
      await applyCompanionSuggestion(latest.id, selected, roomId)
      setHistory(items => items.map(item => item.id === latest.id ? { ...item, applied: true, appliedFields: selected } : item))
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.') } finally { setApplying(false) }
  }
  return <aside className="companion-panel" aria-label={mode === 'chat' ? 'Private Companion' : 'Preference Companion'}>
    <span className="companion-orb" aria-hidden="true">✦</span><p className="section-kicker">GoTogether Companion · Just for you</p>
    <h2>{mode === 'chat' ? 'A little help finding your way.' : 'Turn your notes into a starting point.'}</h2>
    <p>{mode === 'chat' ? 'Explore ideas with your private planning companion. Your saved preferences and itinerary options guide the conversation.' : 'Paste your travel notes, then review the suggestions. Apply only the fields you want to change in your own preferences.'}</p>
    {history.length > 0 && <div className="companion-history" role="log" aria-label="Saved Companion conversation">{history.slice(mode === 'chat' ? -10 : -1).map(item => <article key={item.id}>{item.message && <p className="companion-user-note"><strong>You</strong><br />{item.message}</p>}<small>{sourceLabel(item.source)}</small><p className="companion-reply">{item.summary}</p>{item.notice && <p className="companion-notice">{item.notice}</p>}</article>)}</div>}
    {mode === 'extract' && latest?.extracted && Object.keys(latest.extracted).length > 0 && <fieldset className="companion-suggestions"><legend>Review changes to your preferences</legend>{Object.entries(latest.extracted).map(([field, value]) => <label key={field}><input type="checkbox" checked={(latest.applied ? latest.appliedFields ?? [] : selected).includes(field)} disabled={applying || latest.applied} onChange={event => setSelected(values => event.target.checked ? [...values, field] : values.filter(value => value !== field))} /><span><strong>{fieldNames[field]}</strong>{Array.isArray(value) ? value.join(' · ') : String(value)}</span></label>)}<button className="secondary-button" type="button" disabled={applying || latest.applied || !selected.length} onClick={apply}>{latest.applied ? 'Preferences applied' : applying ? 'Applying…' : 'Apply selected preferences'}</button>{latest.applied && <p role="status">Your preferences are saved. Your quest’s travel ideas have been refreshed.</p>}</fieldset>}
    {context && <p className="canvas-context"><strong>{context.label}</strong><br />{context.detail}</p>}
    <label htmlFor={inputId}>{mode === 'chat' ? 'Ask your Companion' : 'Your travel notes'}</label>
    <textarea id={inputId} value={message} maxLength={4000} onChange={event => setMessage(event.target.value)} placeholder={mode === 'chat' ? 'What are the trade-offs between our options?' : 'I love food and nature. A relaxed pace, and no hiking.'} rows={3} />
    {mode === 'chat' && <label className="companion-crew-choice"><input type="checkbox" checked={includeCrew} onChange={event => setIncludeCrew(event.target.checked)} /><span>Include recent crew chat in this request<small>Send up to 20 messages to the AI provider for context.</small></span></label>}
    {historyLoading && <p role="status">Loading your saved Companion notes…</p>}
    <button className="text-button" type="button" disabled={historyLoading || loading || applying || !message.trim()} onClick={send}>{loading ? 'Thinking…' : mode === 'chat' ? 'Ask Companion' : 'Shape these notes'} <span aria-hidden="true">→</span></button>
    {error && <div role="alert"><p className="form-error">{error}</p><button type="button" className="text-button" disabled={loading || applying || historyLoading} onClick={() => { setHistoryLoading(true); setRevision(value => value + 1) }}>Reload saved notes</button></div>}
  </aside>
}
