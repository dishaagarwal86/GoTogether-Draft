import { Link } from 'react-router-dom'
import { Inspiration } from '../components/Inspiration'

type PageFrameProps = {
  eyebrow: string
  title: string
  children: React.ReactNode
}

function PageFrame({ eyebrow, title, children }: PageFrameProps) {
  return <><section className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lede">Thoughtful places for the people you want beside you.</p></section>{children}</>
}

export function TripsPage() {
  return <PageFrame eyebrow="Your adventures" title="My trips"><div className="empty-panel"><span className="panel-symbol">✦</span><h2>Every trip starts with a maybe.</h2><p>Your planned trips will live here. Head home to start shaping the next one.</p><Link className="primary-button" to="/">Back to home <span>→</span></Link></div></PageFrame>
}

export function InspirationPage() {
  return <PageFrame eyebrow="For the curious" title="Find your next place"><div className="wide-inspiration"><Inspiration /></div></PageFrame>
}
