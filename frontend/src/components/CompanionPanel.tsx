import { useState } from 'react'
import { askCompanion } from '../services/companionApi'

export function CompanionPanel({ context }: { context?: unknown }) {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const send = async () => {
    if (!message.trim()) return
    setLoading(true)
    try { setReply((await askCompanion('extract', message, context)).summary) } catch (error) { setReply(error instanceof Error ? error.message : 'Please try again.') } finally { setLoading(false) }
  }
  return <aside className="companion-panel" aria-label="GoTogether Companion"><span className="companion-orb">✦</span><p className="section-kicker">GoTogether Companion</p><h2>Tell me what the group is feeling.</h2><p>Paste notes from your group chat and I’ll turn them into useful planning signals.</p><label className="sr-only" htmlFor="companion-message">Group notes</label><textarea id="companion-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Maya wants a beach. Rohan wants one big hike…" rows={4} /><button className="text-button" type="button" disabled={loading} onClick={send}>{loading ? 'Thinking…' : 'Shape these notes'} <span>→</span></button>{reply && <p className="companion-reply" role="status">{reply}</p>}</aside>
}
