import { Inspiration } from '../components/Inspiration'
import { questSummaries, type QuestStatus } from '../data/TripsPage'

type PageFrameProps = {
  eyebrow: string
  title: string
  children: React.ReactNode
}

function PageFrame({ eyebrow, title, children }: PageFrameProps) {
  return <><section className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lede">Thoughtful places for the people you want beside you.</p></section>{children}</>
}

export function TripsPage() {
  const groups: { status: QuestStatus; title: string; note: string }[] = [{ status: 'ongoing', title: 'Ongoing quests', note: 'Out there right now' }, { status: 'upcoming', title: 'Upcoming quests', note: 'The next stories to unfold' }, { status: 'completed', title: 'Completed quests', note: 'Treasures you have already found' }]
  return <PageFrame eyebrow="Your adventures" title="My quests"><div className="quest-status-list">{groups.map((group) => { const quests = questSummaries.filter((quest) => quest.status === group.status); return <section className={`quest-status-group ${group.status}`} key={group.status}><div className="quest-status-heading"><div><p>{group.note}</p><h2><i />{group.title}</h2></div><span>{quests.length}</span></div><div className="quest-summary-grid">{quests.map((quest) => <article className="quest-summary-card" key={quest.id}><img src={quest.image} alt={`${quest.destination}, ${quest.country}`} /><div className="quest-summary-copy"><span className="quest-state">{group.status}</span><h3>{quest.destination}<small>{quest.country}</small></h3><p>{quest.title}</p><div className="quest-summary-meta"><span>◷ {quest.dates}</span><span>◌ {quest.travellers}</span></div>{quest.progress && <div className="quest-progress"><span>{quest.progress}</span><i><b /></i></div>}</div></article>)}</div></section>})}</div></PageFrame>
}

export function InspirationPage() {
  return <PageFrame eyebrow="For the curious" title="Find your next place"><div className="wide-inspiration"><Inspiration /></div></PageFrame>
}
