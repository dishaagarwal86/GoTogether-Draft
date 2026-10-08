import { useEffect, useState } from 'react'
import { askCompanion, companionHistory, type CompanionReply } from '../services/companionApi'
import { recommendationPhoto } from '../services/itineraryPresentation'
import type { AnswerValue } from '../data/Questions'

const tilt = (name: string) => {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return ((hash % 9) - 4) * 0.6
}
const photoUrl = (name: string) =>
  recommendationPhoto({ destination: name, cover_image: null })

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
  const places = suggestion?.places ?? []
  return <aside className="preference-nudge">
    <span>✦</span>
    <div>
      <p className="section-kicker">GoTogether Companion</p>
      <h2>Get ideas as you go.</h2>
      <p>Your first set of preferences is enough to start shaping a personal travel direction.</p>
      {suggestion && <div role="status">
        {suggestion.summary && <p className="nudge-summary">{suggestion.summary}</p>}
        {places.length > 0 && <div className="nudge-scrapbook">
          {places.map(place => (
            <div key={place.name} className="nudge-polaroid" style={{ '--tilt': `${tilt(place.name)}deg` } as React.CSSProperties}>
              <div className="nudge-polaroid-photo">
                <img src={photoUrl(place.name)} alt="Travel inspiration" loading="lazy" />
              </div>
              <div className="nudge-polaroid-caption">
                <span className="nudge-polaroid-tag">{place.tag}</span>
                <strong>{place.name}</strong>
                <p>{place.reason}</p>
              </div>
            </div>
          ))}
        </div>}
        {suggestion.notice && <p className="nudge-notice">{suggestion.notice}</p>}
      </div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
    <button type="button" className="text-button" onClick={getSuggestion} disabled={loading}>{loading ? 'Thinking…' : suggestion ? 'Refresh ideas' : 'Suggest a direction'} <b>→</b></button>
  </aside>
}
