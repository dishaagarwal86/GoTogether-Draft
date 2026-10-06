import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TravelArtwork } from './TravelArtwork'
export function Icon({ name = 'arrow', size = 20 }: { name?: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    northeast: <path d="M5 19 19 5M5 5h14v14" />,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-3 5-5 3 3-5 5-3Z" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" /></>,
    spark: <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z" />,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    plane: <path d="m22 2-7 20-4-9-9-4 20-7Zm0 0L11 13" />,
    home: <><path d="m3 10 9-7 9 7v11H3V10Z" /><path d="M9 21v-8h6v8" /></>,
    chat: <path d="M21 11a9 9 0 0 1-9 9H4l-3 3V11a10 10 0 0 1 20 0ZM6 10h10M6 14h6" />,
    moon: <path d="M20 14A8 8 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z" />,
    sunset: <><path d="M3 17h18M5 21h14M6 17a6 6 0 0 1 12 0M12 3v3M4 8l2 2m14-2-2 2" /><path d="m10 9 2-2 2 2" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M17 11h4v5h-4a2.5 2.5 0 0 1 0-5ZM5 5V3h13" /></>,
    leaf: <><path d="M20 3C8 2 2 8 5 15c5 10 16 2 15-12Z" /><path d="M4 21 16 9" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.arrow}</svg>
}
export function Brand() { return <span className="journey-brand"><span className="journey-brand-mark" aria-hidden="true"><i /><i /></span>Go<span className="brand-dot">.</span>Together</span> }
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: ReactNode; description?: string; action?: ReactNode }) {
  return <header className="journey-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div><div className="journey-heading-aside"><TravelArtwork motif="flight" className="heading-flight" />{action}</div></header>
}
export function EmptyState({ title, description, to, label, icon = 'compass' }: { title: string; description: string; to?: string; label?: string; icon?: string }) {
  return <div className="journey-empty"><span className="empty-symbol"><Icon name={icon} size={30} /></span><h2>{title}</h2><p>{description}</p>{to && <Link className="primary-button" to={to}>{label}<Icon /></Link>}</div>
}
export function LoadingState({ label = 'Gathering your next chapter…' }: { label?: string }) { return <div className="journey-loading" role="status"><span className="loading-orbit"><Icon name="compass" size={32} /></span><p>{label}</p></div> }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="journey-error" role="alert"><p>{message}</p>{retry && <button type="button" className="secondary-button" onClick={retry}>Try again <Icon /></button>}</div> }
