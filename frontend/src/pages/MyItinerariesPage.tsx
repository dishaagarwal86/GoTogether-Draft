import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getUserQuests, type Quest } from '../apis/quests'
import { getWorkingPlan, type WorkingPlan } from '../services/workingPlanApi'
import { EmptyState, ErrorState, Icon, LoadingState, PageHeading } from '../components/Ui'

type Itinerary = { quest: Quest; plan: WorkingPlan }
type Bucket = 'upcoming' | 'ongoing' | 'planned' | 'past'

const dates = (plan: WorkingPlan) => plan.bookings?.travel_dates
const formatDate = (value?: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
function bucket(plan: WorkingPlan): Bucket {
  const range = dates(plan)
  if (!range?.start) return 'planned'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(`${range.start}T00:00:00`)
  const end = range.end ? new Date(`${range.end}T00:00:00`) : start
  if (end < today) return 'past'
  if (start <= today) return 'ongoing'
  return 'upcoming'
}
function bookedCount(plan: WorkingPlan) { return (plan.booked?.flights.length ?? 0) + (plan.booked?.stays.length ?? 0) + plan.days.flatMap(day => day.items).filter(item => item.booked).length }
const labels: Record<Bucket, { title: string; copy: string }> = {
  upcoming: { title: 'Coming up', copy: 'Plans with dates on the horizon.' },
  ongoing: { title: 'Happening now', copy: 'Everything you need for the chapter you are in.' },
  planned: { title: 'Planned together', copy: 'Your final plans, ready for dates and bookings.' },
  past: { title: 'Past chapters', copy: 'A record of the trips you made happen.' },
}

export function MyItinerariesPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Itinerary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = async () => {
    if (!user) return
    setLoading(true); setError('')
    try {
      const quests = await getUserQuests(user.id)
      const plans = await Promise.all(quests.map(async quest => ({ quest, plan: await getWorkingPlan(quest.id) })))
      setItems(plans.flatMap(item => item.plan ? [{ quest: item.quest, plan: item.plan }] : []))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your itineraries could not load.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [user?.id])
  const groups = useMemo(() => {
    const values: Record<Bucket, Itinerary[]> = { upcoming: [], ongoing: [], planned: [], past: [] }
    items.forEach(item => values[bucket(item.plan)].push(item))
    return values
  }, [items])
  return <section className="my-itineraries-page">
    <PageHeading eyebrow="THE PLANS YOU'RE MAKING REAL" title={<>My <em>itineraries.</em></>} description="Your finished travel plans, bookings, and every shared moment in one place." action={<Link to="/trips" className="secondary-button">My quests <Icon name="compass" size={16} /></Link>} />
    {loading ? <LoadingState label="Gathering your itineraries…" /> : error ? <ErrorState message={error} retry={() => void load()} /> : !items.length ? <EmptyState title="Your first itinerary is waiting." description="Choose a shared plan from one of your quests and it will appear here." to="/trips" label="Open my quests" /> : <div className="itinerary-library">
      {(['ongoing', 'upcoming', 'planned', 'past'] as Bucket[]).map(kind => groups[kind].length ? <section key={kind} className="itinerary-library-section" aria-labelledby={`itinerary-${kind}`}><header><div><p className="eyebrow">{kind === 'ongoing' ? 'YOUR TRIP IS UNDERWAY' : kind === 'upcoming' ? 'YOUR NEXT CHAPTERS' : kind === 'planned' ? 'READY WHEN YOU ARE' : 'THE STORIES YOU MADE'}</p><h2 id={`itinerary-${kind}`}>{labels[kind].title}</h2><p>{labels[kind].copy}</p></div><span>{groups[kind].length} {groups[kind].length === 1 ? 'itinerary' : 'itineraries'}</span></header><div className="itinerary-library-grid">{groups[kind].map(({ quest, plan }) => <ItineraryCard key={quest.id} quest={quest} plan={plan} kind={kind} />)}</div></section> : null)}
    </div>}
  </section>
}

function ItineraryCard({ quest, plan, kind }: { quest: Quest; plan: WorkingPlan; kind: Bucket }) {
  const range = dates(plan)
  const count = bookedCount(plan)
  const bookedActivities = plan.days.flatMap(day => day.items).filter(item => item.booked)
  return <article className="itinerary-library-card">
    <div className={`itinerary-library-status is-${kind}`}>{kind === 'ongoing' ? 'Ongoing' : kind === 'upcoming' ? 'Upcoming' : kind === 'past' ? 'Past' : 'Final plan'}</div>
    <p className="eyebrow">{quest.name}</p><h3>{plan.title}</h3><p className="itinerary-library-destination"><Icon name="pin" size={15} />{plan.destination}{plan.country ? `, ${plan.country}` : ''}</p>
    <div className="itinerary-library-date"><Icon name="calendar" size={16} />{range?.start ? <span>{formatDate(range.start)}{range.end && range.end !== range.start ? ` – ${formatDate(range.end)}` : ''}</span> : <span>{plan.days.length} days · dates to confirm</span>}</div>
    <div className="itinerary-library-summary"><span><Icon name="check" size={14} />{count ? `${count} booked` : 'No bookings marked yet'}</span><span><Icon name="compass" size={14} />{bookedActivities.length ? `${bookedActivities.length} moments confirmed` : `${plan.days.length} days planned`}</span></div>
    <Link to={`/quests/${quest.id}?tab=itinerary`} className="primary-button">Open itinerary <Icon name="arrow" size={16} /></Link>
  </article>
}
