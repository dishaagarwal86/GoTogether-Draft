import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createQuestPick, type QuestDna, type QuestRecommendation } from '../apis/quests'
import { personaliseItinerary } from '../services/companionApi'
import { photoFallback, recommendationPhoto } from '../services/itineraryPresentation'
import { Icon } from './Ui'
import { TravelPlanningOptions } from './TravelPlanningOptions'

export type ChatContext = { label: string; detail: string }
type Day = { day?: string | number; title?: string; morning?: string; afternoon?: string; evening?: string; description?: string }

function readDays(value: unknown): Day[] {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item && typeof item === 'object').map((item: Record<string, unknown>) => Object.fromEntries(Object.entries(item).filter(([key, val]) => ['day', 'title', 'morning', 'afternoon', 'evening', 'description'].includes(key) && (typeof val === 'string' || key === 'day' && typeof val === 'number'))))
}
const dayLabel = (day: Day, index: number) => String(day.day ?? '').toLowerCase().startsWith('day') ? String(day.day) : `Day ${day.day ?? index + 1}`
const dayTitle = (day: Day, destination: string) => {
  const title = day.title || day.morning?.replace(/\s+at an easy pace\.?$/i, '') || `A day in ${destination}`
  return title.charAt(0).toUpperCase() + title.slice(1)
}

export function ItineraryStory({ trip, roomId, travelDna, onDiscuss }: { trip: QuestRecommendation; roomId: string; travelDna?: QuestDna | null; onDiscuss?: (context: ChatContext) => void }) {
  const days = readDays(trip.daily_plan)
  const [personalStory, setPersonalStory] = useState<Awaited<ReturnType<typeof personaliseItinerary>>['data'] | null>(null)
  const [personalising, setPersonalising] = useState(false)
  const [storyError, setStoryError] = useState('')
  const [picked, setPicked] = useState(false)
  const requestId = useRef(0)
  const dayRefs = useRef<Array<HTMLElement | null>>([])
  const context = { label: `${trip.destination} · ${trip.duration_days} days`, detail: trip.title }
  const discussionAction = (value: ChatContext, label: string, className = 'text-button') => onDiscuss
    ? <button type="button" className={className} onClick={() => onDiscuss(value)}><Icon name="chat" size={17} />{label}</button>
    : <Link className={className} to={`/quests/${roomId}#crew-chat`} state={{ chatContext: value }}><Icon name="chat" size={17} />{label}</Link>
  const personalise = async () => {
    if (personalising) return
    const id = ++requestId.current
    setPersonalising(true); setStoryError('')
    try {
      const itinerary = { ...trip, shortDescription: trip.short_description, dayPlan: days.map((day, index) => ({ day: index + 1, title: day.title ?? day.morning ?? 'A little exploring', description: day.description ?? [day.afternoon, day.evening].filter(Boolean).join(' · '), highlights: [day.morning, day.afternoon].filter(Boolean), mood: trip.moods[0] ?? 'Discovery' })) }
      const result = await personaliseItinerary(travelDna, itinerary, { matchedPreferences: trip.matchedPreferences, compromises: trip.compromises })
      if (id === requestId.current) setPersonalStory(result.data)
    } catch { if (id === requestId.current) setStoryError('The Companion couldn’t personalise this just now. Your original itinerary is still here; try again when you’re ready.') }
    finally { if (id === requestId.current) setPersonalising(false) }
  }
  const savePick = async () => {
    try {
      await createQuestPick(roomId, { type: 'itinerary', title: trip.title, destination: `${trip.destination}, ${trip.country}`, estimatedPrice: trip.estimated_cost_usd, note: trip.short_description })
      setPicked(true)
    } catch { setStoryError('We couldn’t save this to My Picks just now. Please try again.') }
  }
  return <section className="itinerary-story" aria-label={`${trip.destination} itinerary`}>
    <header className="itinerary-cover">
      <img src={recommendationPhoto(trip)} alt={`${trip.destination} travel inspiration`} onError={photoFallback} />
      <div className="itinerary-cover-shade" />
      <span className="itinerary-postmark" aria-hidden="true"><Icon name="compass" size={27} /><span>GO · TOGETHER<br />A POSSIBLE CHAPTER</span></span>
      <div className="itinerary-cover-copy"><p className="eyebrow">{trip.country} / A SUGGESTED ITINERARY</p><h2>{trip.destination}<em>, together.</em></h2><p>{trip.title}</p></div>
    </header>
    <div className="itinerary-passport"><span><Icon name="calendar" size={17} /><strong>{trip.duration_days} days</strong><small>A little room to roam</small></span><span><Icon name="wallet" size={17} /><strong>{trip.budget}</strong><small>Your travel comfort</small></span><span><Icon name="sun" size={17} /><strong>{trip.seasons.length ? trip.seasons.join(' / ') : 'Dates to decide'}</strong><small>{trip.seasons.length ? 'Suggested seasons' : 'Find a time together'}</small></span></div>
    <div className="itinerary-introduction"><p>{trip.short_description}</p><p>A plan for the days you will talk about long after the trip ends.</p><div className="itinerary-reasons"><div><span className="itinerary-note-icon"><Icon name="heart" size={17} /></span><div><h3>Group alignment</h3><p>{trip.matchedPreferences.join(' · ') || 'A new direction with room for every voice.'}</p></div></div><div><span className="itinerary-note-icon"><Icon name="compass" size={17} /></span><div><h3>What was balanced</h3><p>{trip.compromises.join(' ') || 'Everyone’s must-haves have a place in this plan.'}</p></div></div></div></div>
    {days.length > 0 ? <>
      <nav className="itinerary-day-nav" aria-label="Jump to an itinerary day"><span>THE DAYS AHEAD</span><div>{days.map((day, index) => <button type="button" key={index} onClick={() => { dayRefs.current[index]?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); dayRefs.current[index]?.focus({ preventScroll: true }) }}>{dayLabel(day, index)}</button>)}</div></nav>
      <div className="itinerary-timeline">{days.map((day, index) => <article className="itinerary-day" key={index} tabIndex={-1} ref={(node) => { dayRefs.current[index] = node }} aria-label={dayLabel(day, index)}>
        <div className="itinerary-day-heading"><div><span className="itinerary-day-number">{String(index + 1).padStart(2, '0')}</span><div><p className="eyebrow">{dayLabel(day, index)} · {trip.destination}</p><h3>{dayTitle(day, trip.destination)}</h3></div></div>{discussionAction({ label: `${dayLabel(day, index)} · ${trip.destination}`, detail: [day.title, day.morning, day.afternoon, day.evening, day.description].filter(Boolean).join(' · ') }, 'Discuss this day')}</div>
        {day.description && <p className="itinerary-day-description">{day.description}</p>}
        <div className="itinerary-moments">{([{ key: 'morning', label: 'Morning', icon: 'sun' }, { key: 'afternoon', label: 'Afternoon', icon: 'sunset' }, { key: 'evening', label: 'Evening', icon: 'moon' }] as const).map(({ key, label, icon }) => day[key] && <div className={`itinerary-moment itinerary-moment-${key}`} key={key}><span><Icon name={icon} size={20} /></span><div><h4>{label}</h4><p>{day[key]}</p></div></div>)}</div>
      </article>)}</div>
    </> : <p className="itinerary-open-days">The day-by-day details are still open. Use this idea as the starting point for your conversation.</p>}
    <TravelPlanningOptions trip={trip} />
    <footer className="itinerary-next-step"><div><Icon name="people" size={23} /><div><h3>The destination is the setting. Your people make the story.</h3><p>Bring an idea to the conversation before deciding.</p></div></div><div className="itinerary-next-actions"><button className="secondary-button" type="button" onClick={() => void savePick()} disabled={picked}>{picked ? 'Saved to My Picks' : 'Save to My Picks'} <Icon name={picked ? 'check' : 'heart'} size={16} /></button>{discussionAction(context, 'Talk it over with your crew', 'primary-button')}</div></footer>
    <details className="itinerary-companion"><summary><Icon name="spark" size={19} /><span>Make it a little more you.<small>Personalise this idea with the Companion</small></span><Icon name="plus" size={17} /></summary><div><p>Give this starting point a little of your crew’s personality.</p><button className="secondary-button" type="button" disabled={personalising} onClick={personalise}>{personalising ? 'Finding your story…' : 'Personalise with Companion'}<Icon name="spark" size={17} /></button>{storyError && <p className="form-error" role="alert">{storyError}</p>}{personalStory && <section className="companion-story" aria-live="polite"><p className="eyebrow">THE COMPANION’S TAKE</p><h3>{personalStory.resultTitle}</h3><p>{personalStory.scrapbookIntro}</p><ul>{(personalStory.whyItWorks ?? []).map((item) => <li key={item}>{item}</li>)}</ul><p>{personalStory.tradeoffNote}</p><div className="story-days">{personalStory.days.map((day) => <article key={day.day}><b>Day {day.day}</b><h3>{day.title}</h3><p>{day.description}</p></article>)}</div></section>}</div></details>
  </section>
}
