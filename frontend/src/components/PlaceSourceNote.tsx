import type { PlaceSource } from '../services/placeSources'
import '../styles/place-sources.css'

export function PlaceSourceNote({ source }: { source?: PlaceSource }) {
  if (!source || source.scope !== 'identity') return null
  try { if (new URL(source.url).protocol !== 'https:') return null } catch { return null }
  const date = new Date(`${source.checkedAt}T00:00:00Z`)
  if (!Number.isFinite(date.getTime())) return null
  return <div className="place-source-note">
    <a href={source.url} target="_blank" rel="noreferrer" aria-label={`Official source for ${source.name}`} title={source.publisher}>Official source ↗</a>
    <small>Place identity checked <time dateTime={source.checkedAt}>{date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</time>. Hours, prices and availability to confirm.</small>
  </div>
}
