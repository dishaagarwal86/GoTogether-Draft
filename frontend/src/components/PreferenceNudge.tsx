import { useEffect, useState } from 'react'
import { askCompanion, companionHistory, sourceLabel, type CompanionReply } from '../services/companionApi'
import type { AnswerValue } from '../data/Questions'

const signatureOf = (value: unknown) => JSON.stringify(Object.entries((value ?? {}) as Record<string, unknown>).filter(([, item]) => (typeof item === 'string' && item.trim()) || Array.isArray(item)).map(([key, item]) => [key, typeof item === 'string' ? item.trim() : item]).sort(([a], [b]) => String(a).localeCompare(String(b))))
export function PreferenceNudge({ answers, roomId }: { answers: Record<string, AnswerValue>; roomId?: string }) {
  const [suggestion, setSuggestion] = useState<CompanionReply | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const signature = signatureOf(answers)
  useEffect(() => {
    let active = true
    companionHistory('group-dna', roomId).then(items => { if (active) setSuggestion(items.find(item => signatureOf(item.preferences) === signature) ?? null) }).catch(() => { if (active) setError('Saved ideas could not be loaded. You can request another suggestion.') })
    return () => { active = false }
  }, [roomId, signature])
  const getSuggestion = async () => {
    setLoading(true); setError('')
    try { setSuggestion(await askCompanion({ task: 'group-dna', roomId, preferences: answers })) }
    catch (error) { setError(error instanceof Error ? error.message : 'Please try again.') }
    finally { setLoading(false) }
  }
  return <aside className="preference-nudge"><span>✦</span><div><p className="section-kicker">GoTogether Companion</p><h2>Get ideas as you go.</h2><p>Your first set of preferences is enough to start shaping a personal travel direction.</p>{suggestion && <div role="status"><small>{sourceLabel(suggestion.source)}</small><p className="nudge-reply">{suggestion.summary}</p>{suggestion.notice && <p>{suggestion.notice}</p>}</div>}{error && <p className="form-error" role="alert">{error}</p>}</div><button type="button" className="text-button" onClick={getSuggestion} disabled={loading}>{loading ? 'Thinking…' : 'Suggest a direction'} <b>→</b></button></aside>
}
