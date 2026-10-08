import { tripDates, itineraryDayDate, formatTravelDate } from '../services/bookingDates'
import { useRef, useState } from 'react'
import type { JourneyResponse, JourneyVote, QuestJourney, QuestRecommendation } from '../apis/quests'
import { ItineraryInsights } from './ItineraryInsights'
import { TravelPlanningOptions } from './TravelPlanningOptions'
import { Icon } from './Ui'
import { useDestinationPhoto, usePlacePhoto } from '../services/placePhotos'
import { PlacePhotoCaption } from './PlacePhotoCaption'
import { PlaceSourceNote } from './PlaceSourceNote'
import type { PlaceSource } from '../services/placeSources'

import { useInrPricing } from '../services/inrPricing'
import { responseCounts } from '../services/groupReadiness'

import { changeScene } from '../services/sceneTransition'

const reactions = [['love', 'Love it'], ['works', 'Works for me'], ['concern', 'Concern']] as const
type Slot = 'morning' | 'afternoon' | 'evening'
type PreviewDay = { day?: number; title?: string; morning?: string; afternoon?: string; evening?: string; description?: string; moments?: Partial<Record<Slot, { activity: string; detail?: string; imageQuery?: string; placeSource?: PlaceSource }>> }

function OptionCard({ trip, selected, current, eager, onSelect }: { trip: QuestRecommendation; selected: boolean; current: boolean; eager: boolean; onSelect: (element: HTMLElement) => void }) {
  const { src, srcSet, ref, onError } = useDestinationPhoto(trip.destination)
  return <div className="group-option-tile"><button type="button" data-itinerary-id={trip.id} className={`group-option-card${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={event => onSelect(event.currentTarget)}><div className="group-option-photo"><img src={src} srcSet={srcSet} sizes="(max-width: 700px) 245px, 33vw" ref={ref} alt="" onError={onError} loading={eager ? 'eager' : 'lazy'} decoding="async" /><span>{trip.label}</span>{current && <small>Current plan</small>}</div><div><p>{trip.country} · {trip.duration_days} days</p><h3>{trip.destination}<Icon name={selected ? 'check' : 'arrow'} size={18} /></h3><span>{trip.source === 'ai' ? 'AI planned' : 'Catalogue'} · {trip.budget} · {trip.title}</span></div></button></div>
}

function PreviewCover({ trip }: { trip: QuestRecommendation }) {
  const { src, srcSet, ref, onError } = useDestinationPhoto(trip.destination)
  return <><div className="group-preview-cover"><img src={src} srcSet={srcSet} sizes="(max-width: 900px) 100vw, 1100px" ref={ref} alt={trip.destination} onError={onError} decoding="async" /><div><span>{trip.country} · {trip.duration_days} days</span><strong>{trip.destination}</strong><small>{trip.label}</small></div></div></>
}

function PreviewMoment({ day, slot, destination }: { day: PreviewDay; slot: Slot; destination: string }) {
  const moment = day.moments?.[slot]
  const title = moment?.activity || day[slot] || ''
  const { src, srcSet, ref, onError, description, alt } = usePlacePhoto({ title, destination, imageQuery: moment?.imageQuery, placeId: moment?.placeSource?.placeId })
  if (!title) return null
  return <article className="group-preview-moment"><img src={src} srcSet={srcSet} sizes="(max-width: 700px) 90vw, (max-width: 1000px) 45vw, 360px" ref={ref} alt={alt || title} loading="lazy" decoding="async" onError={onError} /><div><small className="group-moment-slot"><Icon name={slot === 'morning' ? 'sun' : slot === 'afternoon' ? 'sunset' : 'moon'} size={16} />{slot}</small><h4>{title}</h4>{moment?.detail && <p>{moment.detail}</p>}<PlacePhotoCaption description={description} /><PlaceSourceNote source={moment?.placeSource} /></div></article>
}
export function GroupResponses({ response, busy, onRespond }: { response: JourneyResponse; busy: boolean; onRespond: (reaction: JourneyVote['reaction'], note: string) => Promise<void> }) {
  const tally = responseCounts(response, response.people.length)
  const mine = response.people.find(person => person.isMe)
  const [note, setNote] = useState(mine?.note ?? '')
  const [concern, setConcern] = useState(false)
  const [responseError, setResponseError] = useState('')
  const send = async (reaction: JourneyVote['reaction'], note: string) => { setResponseError(''); try { await onRespond(reaction, note); setConcern(false) } catch (reason) { setResponseError(reason instanceof Error ? reason.message : 'Your response could not save. Please try again.') } }
  return <div className="group-responses"><div className="group-response-heading"><strong>{response.agreed ? 'Works for everyone' : `${response.answered} responses · ${response.concerns ? `${response.concerns} concern${response.concerns > 1 ? 's' : ''}` : 'Every voice counts'}`}</strong><div className="group-avatars">{response.people.map(person => <span key={person.id} className={person.reaction ? `is-${person.reaction}` : ''} title={`${person.name}: ${person.reaction ? reactions.find(([key]) => key === person.reaction)?.[1] : 'Waiting for a response'}`}>{person.name.slice(0, 1)}</span>)}</div></div><div className="group-decision-tally" aria-label="Responses to this itinerary"><span>{tally.okay} okay with it</span><span>{tally.concerns} have concerns</span><span>{tally.waiting} yet to respond</span></div><div className="group-reaction-buttons">{reactions.map(([key, label]) => <button type="button" key={key} aria-pressed={mine?.reaction === key} disabled={busy} onClick={() => key === 'concern' ? setConcern(true) : void send(key, '')}><Icon name={key === 'love' ? 'heart' : key === 'works' ? 'check' : 'chat'} size={16} />{label}</button>)}</div>{concern && <form className="group-concern" onSubmit={event => { event.preventDefault(); void send('concern', note) }}><label>What would make this work better? <span>Optional · shared with your crew</span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={600} rows={2} /></label><button type="submit" disabled={busy}>Share concern</button><button type="button" onClick={() => setConcern(false)}>Cancel</button></form>}{responseError && <p className="form-error" role="alert">{responseError}</p>}{response.people.filter(person => person.reaction === 'concern').map(person => <p className="group-concern-note" key={person.id}><strong>{person.name}:</strong> {person.note || 'Would like to discuss another option.'}</p>)}</div>
}

export function GroupOptions({ journey, busy, onRespond, onChoose, onDiscuss, currentId, roomId }: { roomId?: string; journey: QuestJourney; busy: boolean; onRespond: (vote: JourneyVote) => Promise<void>; onChoose?: (id: string) => void; onDiscuss?: (label: string, detail: string) => void; currentId?: string }) {
  const pricing = useInrPricing()
  const solo = journey.totalMembers === 1
  const root = useRef<HTMLElement>(null)
  const returnPosition = useRef({ page: 0, grid: 0 })
  const [focused, setFocused] = useState(false)
  const selectionKey = `gotogether.option-preview.${roomId ?? journey.preferenceVersion}`
  const readSelection = (field: string, fallback: string) => { try { return sessionStorage.getItem(`${selectionKey}.${field}`) || fallback } catch { return fallback } }
  const remember = (field: string, value: string) => { try { sessionStorage.setItem(`${selectionKey}.${field}`, value) } catch { /* Browsing remains available without storage. */ } }
  const [view, updateView] = useState(() => readSelection('view', 'recommended'))
  const setView = (value: string) => changeScene(() => { updateView(value); remember('view', value); setDay('all'); setFocused(false) }, 'preview')
  const [selectedId, setSelectedId] = useState(() => readSelection('id', ''))
  const [search, setSearch] = useState('')
  const [day, setDay] = useState<number | 'all'>('all')
  const aiTrips = journey.allResults.filter(trip => trip.source === 'ai')
  const options = (view === 'ai' ? aiTrips : view === 'all' ? journey.allResults : journey.results).filter(trip => `${trip.destination} ${trip.title} ${trip.country}`.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find(trip => trip.id === selectedId) ?? options[0]
  const select = (id: string, source?: HTMLElement, direction: 'forward' | 'back' = 'forward') => {
    const photo = source?.querySelector<HTMLElement>('.group-option-photo')
    if (!focused) returnPosition.current = { page: window.scrollY, grid: root.current?.querySelector('.group-option-grid')?.scrollTop ?? 0 }
    changeScene(() => {
      setSelectedId(id); remember('id', id); setDay('all'); setFocused(true)
    }, 'preview', direction, () => {
      root.current?.querySelector<HTMLElement>('.group-preview-navigation')?.scrollIntoView({ block: 'start', behavior: 'instant' })
      if (source) root.current?.querySelector<HTMLElement>('.group-preview-title')?.focus({ preventScroll: true })
    }, photo)
  }
  const backToOptions = () => changeScene(() => setFocused(false), 'preview', 'back', () => {
    const grid = root.current?.querySelector<HTMLElement>('.group-option-grid')
    if (grid) grid.scrollTop = returnPosition.current.grid
    root.current?.querySelector<HTMLElement>('.group-option-card.is-selected')?.focus({ preventScroll: true })
    window.scrollTo({ top: returnPosition.current.page, behavior: 'instant' })
  })
  const selectDay = (value: number | 'all') => changeScene(() => setDay(value), 'day', value === 'all' || typeof day === 'number' && value < day ? 'back' : 'forward')
  const selectedIndex = options.findIndex(trip => trip.id === selected?.id)
  if (!journey.ready) return <div className="group-empty"><Icon name="people" size={34} /><h2>{solo ? <>Let’s make this<br /><em>your kind of trip.</em></> : <>Good plans make room<br />for <em>every voice.</em></>}</h2><p>{solo ? 'Add your travel style in Your trip to find itineraries that fit you.' : `${journey.memberCount} of ${journey.totalMembers} travellers have confirmed their preferences. Your group’s matches will appear here when everyone is ready.`}</p>{!solo && <p>Keep collecting ideas and talking with your crew in the meantime.</p>}</div>
  if (!journey.allResults.length && journey.generationPending) return <div className="group-empty" role="status"><Icon name="spark" size={34} /><h2>Finding your next adventure.</h2><p>Your preferences are ready. We’re building a few itinerary ideas for you. You can keep exploring your room while they load.</p></div>
  if (!journey.allResults.length) return <><AiPlanningStatus journey={journey} count={0} /><div className="group-empty"><Icon name="compass" size={34} /><h2>Let’s find some<br /><em>common ground.</em></h2>{journey.blockers.map(message => <p key={message}>{message}</p>)}<p>{solo ? 'Open Your trip to adjust your preferences or save ideas for later.' : 'Open Your crew to update your own preferences, or talk through the choices in Crew chat. Nobody’s limits are silently relaxed.'}</p></div></>
  const days = selected && Array.isArray(selected.daily_plan) ? selected.daily_plan as PreviewDay[] : []
  return <section ref={root} className={`group-options${focused ? ' is-preview-focused' : ''}`}><header className="group-section-heading"><div><p className="eyebrow">{solo ? 'A LITTLE MORE YOU, IN EVERY DAY' : `ALL ${journey.totalMembers} VOICES, ONE ADVENTURE`}</p><h2>A few ways to<br /><em>{solo ? 'follow your curiosity.' : 'go together.'}</em></h2><p>{solo ? 'Explore every day, pick your favourite, and make it your own.' : 'Switch between options. Explore every day. Find the one that works for your people.'}</p></div><span className="group-count"><Icon name="check" size={15} />{journey.allResults.length} matching itineraries</span></header>
    <AiPlanningStatus journey={journey} count={aiTrips.length} />
    <div className="group-option-controls"><div role="group" aria-label="Itinerary collection"><button aria-pressed={view === 'recommended'} onClick={() => { setView('recommended'); setSearch('') }}>Recommended</button><button aria-pressed={view === 'all'} onClick={() => setView('all')}>All matching itineraries ({journey.allResults.length})</button><button aria-pressed={view === 'ai'} onClick={() => { setView('ai'); setSearch('') }}>AI planned ({aiTrips.length})</button></div>{view === 'all' && <label><Icon name="compass" size={16} /><input aria-label="Find an itinerary" value={search} onChange={event => { setSearch(event.target.value); setDay('all') }} placeholder="Find a destination or itinerary" /></label>}</div>
    <div className="group-option-grid" hidden={focused} role="group" aria-label="Choose an itinerary to preview">{options.map(trip => <OptionCard key={trip.id} trip={trip} selected={selected?.id === trip.id} current={trip.id === currentId} eager={view === 'recommended'} onSelect={element => select(trip.id, element)} />)}</div>
    {!selected && <p role="status">{view === 'ai' ? journey.generationPending ? 'Your AI plans will appear here as they finish. You can explore Recommended while you wait.' : 'No AI plans currently match this trip. Open Recommended to continue with the catalogue.' : 'No matching itinerary has that name. Try another search.'}</p>}
    {selected && <><nav className="group-preview-navigation" aria-label="Itinerary preview navigation">{focused ? <button type="button" onClick={backToOptions}><Icon name="arrow" size={16} />Back to options</button> : <span>TAKE A CLOSER LOOK</span>}<div><span aria-live="polite">{selectedIndex + 1} of {options.length}<span className="sr-only"> · {selected.destination}</span></span><button type="button" aria-label="Previous itinerary" disabled={selectedIndex <= 0} onClick={() => select(options[selectedIndex - 1].id, undefined, 'back')}>←</button><button type="button" aria-label="Next itinerary" disabled={selectedIndex >= options.length - 1} onClick={() => select(options[selectedIndex + 1].id)}>→</button></div></nav><article className="group-itinerary-detail" key={selected.id} aria-label={`${selected.destination} full itinerary`}><PreviewCover trip={selected} /><header><div><p className="eyebrow">{selected.label}</p><h2 className="group-preview-title" tabIndex={-1}>{selected.title}</h2><p>{selected.short_description}</p></div><div className="group-estimate"><span>{selected.duration_days} days · {selected.budget}</span><strong>{pricing.format(selected.estimated_cost_usd)}</strong><small>{selected.source === 'ai' ? 'AI estimate' : 'Catalogue estimate'} per person.<br />Confirm inclusions, prices and availability.</small><small className="group-currency-note">{pricing.note}</small></div></header>
      <nav className="planning-shortcuts" aria-label="Preview planning tools"><button onClick={() => { const element = root.current?.querySelector<HTMLElement>('.preview-bookings'); element?.scrollIntoView({ block: 'start', behavior: 'instant' }); element?.focus({ preventScroll: true }) }}><Icon name="plane" size={18} />Flights & stays</button><span>{selected.source === 'ai' ? 'AI planned · review the details before booking' : 'Catalogue itinerary · customise after choosing'}</span></nav>
      <div className="group-fit-notes"><div><Icon name="people" size={20} /><strong>{solo ? 'Your travel style' : 'For your group'}{selected.score != null ? ` · ${selected.score}/100 fit` : ''}</strong><p>{selected.matchedPreferences.join(' · ') || (solo ? 'A mix of experiences within your preferences.' : 'A different mix of experiences within your shared requirements.')}</p></div><div><Icon name="heart" size={20} /><strong>For you</strong><p>{selected.personalFit != null ? `${selected.personalFit}/100 preference fit. This measures preference fit. It does not measure factual accuracy or confirm availability.` : solo ? 'Matched to your preferences.' : 'Your preferences are included in the shared match.'}</p></div><div><Icon name="sliders" size={20} /><strong>The trade-off</strong><p>{selected.compromises.join(' ')}</p></div></div>
      <div className="group-day-tabs" role="group" aria-label="Preview itinerary days"><button aria-pressed={day === 'all'} onClick={() => selectDay('all')}>Full itinerary</button>{days.map((_, index) => <button key={index} aria-pressed={day === index} onClick={() => selectDay(index)}>Day {index + 1}</button>)}</div>
      <div className="group-preview-days">{days.map((value, index) => (day === 'all' || day === index) && <section key={index} className="group-preview-day" aria-label={`Day ${index + 1}`}><header className="group-day-heading"><span className="group-day-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><p className="eyebrow">Day {index + 1} · {selected.destination}</p><h3>{value.title || `Your day in ${selected.destination}`}</h3><p className="booking-day-date">{formatTravelDate(itineraryDayDate(tripDates(selected), index))}</p>{value.description && <p>{value.description}</p>}</div>{!solo && onDiscuss && <button onClick={() => onDiscuss(`Day ${index + 1} · ${selected.destination}`, [value.morning, value.afternoon, value.evening].filter(Boolean).join(' · '))} aria-label={`Discuss day ${index + 1}`}><Icon name="chat" size={17} /></button>}</header><div className="group-day-moments">{(['morning', 'afternoon', 'evening'] as const).map(slot => <PreviewMoment key={slot} day={value} slot={slot} destination={selected.destination} />)}</div></section>)}</div>
      <div className="group-option-decision">{!solo && <GroupResponses key={`${selected.id}:${journey.preferenceVersion}`} response={journey.options[selected.id]} busy={busy} onRespond={(reaction, note) => onRespond({ kind: 'option', optionId: selected.id, version: journey.preferenceVersion, reaction, note })} />}<div className="group-choose"><p>{solo ? 'Choose this starting point. You can edit, reorder or replace it whenever you like.' : journey.options[selected.id].agreed ? 'Everyone has responded positively. Your host can make this the shared itinerary.' : 'Everyone responds before the host chooses. Switching previews never changes your saved plan.'}</p>{onChoose && selected.id !== currentId && <button className="primary-button" disabled={busy || !solo && !journey.options[selected.id].agreed} onClick={() => onChoose(selected.id)}>{currentId ? 'Use this itinerary instead' : solo ? 'Make this my plan' : 'Make this our plan'}<Icon /></button>}{selected.id === currentId && <span><Icon name="check" size={16} />Your current starting itinerary</span>}</div></div>
      {roomId && <ItineraryInsights key={`${selected.id}:${journey.preferenceVersion}`} trip={selected} roomId={roomId} version={journey.preferenceVersion} />}
      <div className="preview-bookings" tabIndex={-1}><TravelPlanningOptions trip={selected} travelDna={journey.travelDna} /></div>
    </article></>}
  </section>
}

function AiPlanningStatus({ journey, count }: { journey: QuestJourney; count: number }) {
  return <aside className="planning-ai-status" aria-label="AI itinerary planning"><Icon name="spark" size={22} /><div><strong>{journey.generationPending || journey.generationStatus === 'queued' ? 'Your AI itineraries are taking shape' : count ? `${count} AI itineraries made for this trip` : journey.generationStatus === 'unconfigured' || journey.generationStatus === 'unavailable' ? 'AI itinerary planning is currently unavailable' : 'Explore your matching itineraries'}</strong><p>{journey.generationPending || journey.generationStatus === 'queued' ? 'We’re using the confirmed preferences from every traveller. Browse the catalogue while we prepare your options.' : count ? 'Compare your generated plans, including route and stay ideas. Your group’s preferences and agreement rules still apply.' : 'These are catalogue suggestions. Generated plans will be labelled AI planned when available. You can keep planning with these options.'}</p></div></aside>
}
