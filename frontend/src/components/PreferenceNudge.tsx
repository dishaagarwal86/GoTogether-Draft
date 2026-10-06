import { useState } from 'react'
import { askCompanion } from '../services/companionApi'
import type { AnswerValue } from '../data/Questions'

export function PreferenceNudge({ answers }: { answers: Record<string, AnswerValue> }) {
  const [suggestion, setSuggestion] = useState('')
  const [loading, setLoading] = useState(false)
  const getSuggestion = async () => {
    setLoading(true)
    try { setSuggestion((await askCompanion('group-dna', undefined, { preferences: answers, travellers: 1 })).summary) }
    catch { setSuggestion('The Companion couldn’t respond just now. You can keep planning and try again later.') }
    finally { setLoading(false) }
  }
  return <aside className="preference-nudge"><span>✦</span><div><p className="section-kicker">GoTogether Companion</p><h2>Get ideas as you go.</h2><p>Your first set of preferences is enough to start shaping a personal travel direction.</p>{suggestion && <p className="nudge-reply" role="status">{suggestion}</p>}</div><button type="button" className="text-button" onClick={getSuggestion} disabled={loading}>{loading ? 'Thinking…' : 'Suggest a direction'} <b>→</b></button></aside>
}
