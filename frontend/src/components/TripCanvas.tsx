import { PlaceSourceNote } from './PlaceSourceNote'
import { useEffect, useRef, useState, type ReactNode, type FormEvent, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Ui'
import { dayWarnings, getAreaIdeas, getConfirmations, setConfirmation, type AreaIdea, type Confirmations, type IdeaCategory, type PlanCommand, type PlanItem, type WorkingPlan } from '../services/workingPlanApi'
import type { BookingTrip, QuestDna } from '../apis/quests'
import { usePlacePhoto, useDestinationPhoto } from '../services/placePhotos'
import { PlacePhotoCaption } from './PlacePhotoCaption'
import { TravelPlanningOptions } from './TravelPlanningOptions'
import { changeScene } from '../services/sceneTransition'
import { useItineraryMotion } from '../hooks/useItineraryMotion'

type Panel = 'ideas' | 'companion' | 'crew'
type Context = { dayId?: string; label: string; detail: string }
type Props = {
  plan: WorkingPlan; saving: boolean; error: string; status: string; readOnly?: boolean; preview?: boolean; solo?: boolean;
  onChange: (command: PlanCommand) => Promise<boolean>; onReload?: () => void; onRetry?: () => Promise<boolean>;
  onInvite?: () => void; preferencesUrl?: string; roomId?: string;
  renderCompanion: (context: Context | null, dayId: string) => ReactNode;
  renderCrew: (open: boolean, context: Context | null, clear: () => void, close: () => void) => ReactNode;
  learning?: ReactNode; extraIdeas?: (discuss: (label: string, detail: string) => void) => ReactNode; unread?: number;
  trip?: BookingTrip | null; travelDna?: QuestDna | null; notice?: ReactNode; focusMode?: boolean;
}
const types: Record<PlanItem['kind'], { label: string; icon: string }> = {
  experience: { label: 'Explore', icon: 'compass' }, food: { label: 'Food & drink', icon: 'sun' },
  stay: { label: 'Stay', icon: 'home' }, transport: { label: 'Getting there', icon: 'plane' }, free: { label: 'A little breathing room', icon: 'leaf' },
}
const ideaItems: Array<{ title: string; kind: PlanItem['kind']; note: string; placeId?: string }> = [
  { title: 'A slow breakfast', kind: 'food', note: 'Find a local café nearby. Check its location and opening hours.' },
  { title: 'An afternoon with no plans', kind: 'free', note: 'Leave room for a detour, a book, or doing absolutely nothing.' },
  { title: 'A local cooking class', kind: 'experience', note: 'An idea to research together. Venue, cost and availability are not confirmed.' },
  { title: 'A neighbourhood wander', kind: 'experience', note: 'Choose a route and confirm walking distance and accessibility.' },
]

export function TripCanvas({ plan, saving, error, status, readOnly = false, preview = false, solo = false, onChange, onReload, onRetry, onInvite, preferencesUrl, roomId = 'preview', learning, renderCompanion, renderCrew, extraIdeas, unread = 0, trip, travelDna, notice, focusMode = false }: Props) {
  const viewKey = `gotogether.workspace-view.${roomId}`
  const [dayId, setDayId] = useState(() => { try { return sessionStorage.getItem(viewKey) || plan.days[0].id } catch { return plan.days[0].id } })
  const day = plan.days.find(item => item.id === dayId) ?? plan.days[0]
  const dayIndex = plan.days.indexOf(day)
  const [panel, setPanel] = useState<Panel | null>(() => window.innerWidth > 900 ? 'ideas' : null)
  const [context, setContext] = useState<Context | null>(null)
  const [crewContext, setCrewContext] = useState<Context | null>(null)
  const [editor, setEditor] = useState<{ item?: PlanItem; suggestion?: typeof ideaItems[number] } | null>(null)
  const [moveItem, setMoveItem] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [drop, setDrop] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const side = useRef<HTMLElement>(null)
  const dayHeading = useRef<HTMLHeadingElement>(null)
  const bookings = useRef<HTMLDivElement>(null)
  const timeline = useRef<HTMLDivElement>(null)
  useItineraryMotion(timeline, day.id, day.items.map(item => item.id).join('|'))
  const drag = useRef<{ id: string; x: number; y: number; active: boolean } | null>(null)
  const blocked = saving || readOnly
  const [confirmState, setConfirmState] = useState<Confirmations | null>(null)
  const confirmations = confirmState?.revision === plan.revision ? confirmState.confirmations : {}
  const [confirming, setConfirming] = useState(false)
  const memberCount = confirmState?.memberCount ?? 0
  useEffect(() => {
    if (preview || solo) return
    let active = true; let loading = false
    const load = async () => {
      if (loading || document.hidden) return
      loading = true
      try { const value = await getConfirmations(roomId); if (active) setConfirmState(value) } catch { /* The plan remains editable if confirmations cannot load. */ }
      finally { loading = false }
    }
    load()
    const timer = window.setInterval(load, 30000)
    return () => { active = false; window.clearInterval(timer) }
  }, [roomId, preview, solo, plan.revision])
  const toggleConfirm = async (itemId: string, confirmed: boolean) => {
    const version = confirmState?.revision === plan.revision ? confirmState.versions[itemId] : undefined
    if (!version || confirming) return
    setConfirming(true)
    try { setConfirmState(await setConfirmation(roomId, itemId, confirmed, version)) }
    catch (reason) {
      setAnnouncement(reason instanceof Error ? reason.message : 'Your confirmation could not be saved. Please try again.')
      setConfirmState(await getConfirmations(roomId).catch(() => null))
    } finally { setConfirming(false) }
  }
  const { src: image, srcSet: coverSrcSet, ref: coverRef, onError: coverError } = useDestinationPhoto(plan.destination)
  const warnings = dayWarnings(day)
  const showPanel = (next: Panel | null) => changeScene(() => setPanel(next), 'tools', next ? 'forward' : 'back')
  const openPanel = (next: Panel) => changeScene(() => { setPanel(next); setEditor(null); setMoveItem(null) }, 'tools')
  const changeDay = (id: string) => {
    const direction = plan.days.findIndex(value => value.id === id) < dayIndex ? 'back' : 'forward'
    changeScene(() => { setDayId(id); setEditor(null); setMoveItem(null) }, 'day', direction, () => dayHeading.current?.focus({ preventScroll: true }))
    try { sessionStorage.setItem(viewKey, id) } catch { /* A view preference is optional. */ }
  }
  const apply = async (command: PlanCommand, message: string) => {
    const success = await onChange(command)
    if (success) { setAnnouncement(message); setMoveItem(null); setEditor(null) }
    return success
  }
  const ask = (item?: PlanItem, shared = false) => {
    const value = { dayId: day.id, label: `${day.title}${item ? ` · ${item.title}` : ''}`, detail: item ? `${item.time} · ${item.duration} min. ${item.note}` : day.items.map(item => item.title).join(' · ') }
    if (shared) setCrewContext(value); else setContext(value)
    openPanel(shared ? 'crew' : 'companion')
  }
  useEffect(() => {
    if (!announcement) return
    const timer = window.setTimeout(() => setAnnouncement(''), 6000)
    return () => window.clearTimeout(timer)
  }, [announcement])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const update = () => { setCompact(media.matches); if (media.matches) setPanel(null) }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!panel || !compact) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    side.current?.querySelector<HTMLButtonElement>('.canvas-panel-close')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { showPanel(null); return }
      if (event.key !== 'Tab') return
      const controls = [...side.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], textarea, input, select, [tabindex="0"]') ?? []].filter(el => el.getClientRects().length)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [panel, compact])

  // Pointer dragging uses only the handle, so scrolling a card on a phone still works.
  const pointerDown = (event: PointerEvent<HTMLButtonElement>, item: PlanItem) => {
    if (blocked || item.locked || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: item.id, x: event.clientX, y: event.clientY, active: false }
  }
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return
    if (Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) < 7 && !drag.current.active) return
    drag.current.active = true; setDragging(drag.current.id)
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-drop-day]')
    setDrop(target ? `${target.dataset.dropDay}:${target.dataset.dropIndex ?? 'end'}` : null)
  }
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-drop-day]')
    if (current?.active && target) {
      const targetDay = plan.days.find(value => value.id === target.dataset.dropDay)
      if (targetDay) {
        const sourceIndex = targetDay.items.findIndex(item => item.id === current.id)
        const beforeIndex = target.dataset.dropIndex ? Number(target.dataset.dropIndex) : targetDay.items.length
        // Drop indicators mark the space before a card; account for removing the source first.
        const index = sourceIndex >= 0 && sourceIndex < beforeIndex ? beforeIndex - 1 : beforeIndex
        if (sourceIndex !== index) void apply({ type: 'move', itemId: current.id, dayId: targetDay.id, index }, `Moved to ${targetDay.title}. Suggested time is unchanged.`)
      }
    }
    drag.current = null; setDragging(null); setDrop(null)
  }
  const cancelDrag = () => { drag.current = null; setDragging(null); setDrop(null) }
  return <section className="trip-canvas" aria-label="Trip workspace">
    <div className="canvas-breadcrumb"><Link to={preview ? '/travel-dna/new' : '/trips'}>← {preview ? 'Start your own trip' : 'All your quests'}</Link><span><Icon name="plane" size={15} /> A LITTLE LESS SOMEDAY</span></div>
    {preview && <div className="canvas-preview-note"><span>Interactive preview · sample itinerary · changes last until you leave</span><Link to="/travel-dna/new">Make a real plan <Icon size={14} /></Link></div>}
    <header className="canvas-cover"><img className="canvas-cover-photo" src={image} srcSet={coverSrcSet} sizes="100vw" ref={coverRef} alt="" decoding="async" fetchPriority="high" onError={coverError} /><span className="canvas-cover-shade" aria-hidden="true" />
      <div><p className="canvas-kicker"><span /> YOUR TRAVEL BOOK · DRAFT</p>{renaming ? <form className="canvas-rename" onSubmit={event => { event.preventDefault(); const title = String(new FormData(event.currentTarget).get('title')); void apply({ type: 'rename', title }, 'Trip renamed.').then(ok => { if (ok) setRenaming(false) }) }}><label className="sr-only" htmlFor="canvas-title">Trip name</label><input id="canvas-title" name="title" defaultValue={plan.title} maxLength={100} required autoFocus /><button disabled={blocked}>Save</button><button type="button" onClick={() => setRenaming(false)}>Cancel</button></form> : <h1>{plan.title}<button className="canvas-edit-title" onClick={() => setRenaming(true)} disabled={blocked} aria-label="Rename trip"><Icon name="edit" size={17} /></button></h1>}<p className="canvas-cover-note">A few good days. A little room for the unexpected.</p><div className="canvas-trip-meta"><span><Icon name="pin" size={15} />{plan.destination}, {plan.country}</span><span><Icon name="calendar" size={15} />{plan.days.length} days · draft itinerary</span><span><Icon name="wallet" size={15} />Costs to confirm</span></div></div>
      <div className="canvas-cover-stamp" aria-hidden="true"><Icon name="compass" size={33} /><span>TAKE THE<br />SCENIC ROUTE</span></div>
    </header>
    {notice}<div className="canvas-focus-hide" hidden={focusMode}><div className="canvas-toolbar"><div className="canvas-save-state" role="status"><Icon name={error ? 'clock' : 'check'} size={15} />{saving ? 'Saving your change…' : status}</div><div><button className="canvas-plain" disabled={blocked || !plan.canUndo} onClick={() => void apply({ type: 'undo' }, 'Last change undone.')}><Icon name="undo" size={16} />Undo</button>{preferencesUrl && <Link className="canvas-plain" to={preferencesUrl}><Icon name="sliders" size={16} />My needs</Link>}{onInvite && <button className="canvas-share" onClick={onInvite}><Icon name="people" size={16} />Invite your people</button>}</div></div>
    {error && <div className="canvas-save-error" role="alert"><span>{error}</span>{onRetry && <button disabled={saving} onClick={() => { void onRetry().then(ok => { if (ok) { setEditor(null); setMoveItem(null); setAnnouncement('Your change is saved.') } }) }}>Retry my change</button>}{onReload && <button onClick={onReload}>Load latest plan</button>}</div>}
    {learning}
    {readOnly && <p className="canvas-viewer-note">Your host edits the shared plan. Open Crew to suggest a change.</p>}
    <nav className="planning-shortcuts" aria-label="Plan your trip"><button onClick={() => openPanel('companion')}><Icon name="spark" size={18} />AI Companion</button><button onClick={() => { bookings.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); bookings.current?.focus({ preventScroll: true }) }}><Icon name="plane" size={18} />Flights & stays</button><span>Explore routes, places to stay, and changes to your plan.</span></nav>
    <div className={`canvas-layout ${panel ? 'has-panel' : ''}`}>
      <section className="canvas-plan-area" aria-label="Editable itinerary">
        <nav className="canvas-days" aria-label="Itinerary days">{plan.days.map((value, index) => <button key={value.id} className={`${day.id === value.id ? 'active' : ''} ${drop?.startsWith(value.id + ':') ? 'is-drop-target' : ''}`} onClick={() => changeDay(value.id)} aria-pressed={day.id === value.id} data-drop-day={value.id}><span>DAY {String(index + 1).padStart(2, '0')}</span><strong>{index === 0 ? 'Settle in' : index === plan.days.length - 1 ? 'One more memory' : 'Find your rhythm'}</strong><small>{value.items.length} moments</small></button>)}</nav>
        <div className="canvas-day-heading"><div><p className="canvas-kicker">CHAPTER {String(dayIndex + 1).padStart(2, '0')} · {plan.destination.toUpperCase()}</p><h2 ref={dayHeading} tabIndex={-1}>{dayIndex === 0 ? <>Ease into <em>somewhere new.</em></> : <>Make room for <em>a good day.</em></>}</h2><p>Move things around. Keep what feels like you.</p></div><button className="canvas-round" aria-label="Ask Companion about this day" onClick={() => ask()}><Icon name="spark" size={20} /></button></div>
        {warnings.map(message => <p className="canvas-warning" role="status" key={message}><Icon name="clock" size={16} />{message}</p>)}
        <div ref={timeline} className={`canvas-timeline ${dragging ? 'is-dragging' : ''}`}>
          {day.items.map((item, index) => <div className={`canvas-slot ${drop === `${day.id}:${index}` ? 'is-drop-target' : ''}`} data-drop-day={day.id} data-drop-index={index} data-motion-item={item.id} key={item.id}>
            <div className="canvas-time"><span>{item.time}</span><i /></div>
            <article className={`canvas-activity kind-${item.kind} ${item.kind !== 'free' ? 'has-photo' : ''} ${item.locked ? 'is-locked' : ''} ${dragging === item.id ? 'being-dragged' : ''}`} aria-label={item.title} data-item-id={item.id}>
              {item.kind !== 'free' && <ActivityPhoto kind={item.kind} title={item.title} imageQuery={item.imageQuery} destination={plan.destination} placeId={item.placeSource?.placeId} />}
              <div className="canvas-activity-top"><span className="canvas-type"><Icon name={types[item.kind].icon} size={15} />{types[item.kind].label}</span><div>{item.locked && <span className="canvas-lock-label"><Icon name="lock" size={12} />Locked</span>}<button className="canvas-drag-handle" aria-label={`Drag ${item.title}`} title="Drag to another position or day. Use Move for tap and keyboard controls." disabled={blocked || item.locked} onPointerDown={event => pointerDown(event, item)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelDrag} onKeyDown={event => { if (event.key === 'Escape') cancelDrag() }}><Icon name="grip" size={18} /></button></div></div>
              <h3>{item.title}</h3><p className="canvas-activity-note">{item.note}</p><PlaceSourceNote source={item.placeSource} /><div className="canvas-activity-meta"><span><Icon name="clock" size={13} />{item.duration} min suggested</span><span>{item.kind === 'free' ? 'Unscheduled possibilities' : 'Details to confirm'}</span></div>
              {!preview && !solo && <ConfirmRow disabled={confirming || saving || confirmState?.revision !== plan.revision} people={confirmations[item.id] ?? []} memberCount={memberCount} onToggle={confirmed => toggleConfirm(item.id, confirmed)} />}
                            <div className="canvas-card-actions"><button disabled={blocked || item.locked} onClick={() => { setEditor({ item }); setMoveItem(null) }}>Edit / replace</button><button disabled={blocked || item.locked} aria-expanded={moveItem === item.id} onClick={() => { setMoveItem(moveItem === item.id ? null : item.id); setEditor(null) }}>Move</button><button disabled={blocked} onClick={() => void apply({ type: 'lock', itemId: item.id }, item.locked ? 'Activity unlocked.' : 'Activity locked. Unlock it before moving or editing.')} aria-label={`${item.locked ? 'Unlock' : 'Lock'} ${item.title}`}><Icon name="lock" size={14} /></button><button onClick={() => ask(item)} aria-label={`Ask Companion about ${item.title}`}><Icon name="spark" size={15} /></button><button onClick={() => ask(item, true)} aria-label={solo ? `Note about ${item.title}` : `Discuss ${item.title} with crew`}><Icon name="chat" size={15} /></button><button className="canvas-remove" disabled={blocked || item.locked} aria-label={`Remove ${item.title}`} onClick={() => void apply({ type: 'remove', itemId: item.id }, 'Activity removed. You can undo this change.')}><Icon name="close" size={14} /></button></div>
              {moveItem === item.id && <div className="canvas-move-menu" aria-label={`Move ${item.title}`}><span>Move to a day</span><div>{plan.days.map(value => <button key={value.id} disabled={blocked} onClick={() => void apply({ type: 'move', itemId: item.id, dayId: value.id, index: value.items.length }, `Moved to ${value.title}.`)}>{value.title}</button>)}</div><div><button disabled={blocked || index === 0} onClick={() => void apply({ type: 'move', itemId: item.id, dayId: day.id, index: index - 1 }, 'Moved earlier in the day.')}>↑ Move earlier</button><button disabled={blocked || index === day.items.length - 1} onClick={() => void apply({ type: 'move', itemId: item.id, dayId: day.id, index: index + 1 }, 'Moved later in the day.')}>↓ Move later</button></div></div>}
            </article>
          </div>)}
          <div className={`canvas-add-slot ${drop === `${day.id}:${day.items.length}` ? 'is-drop-target' : ''}`} data-drop-day={day.id} data-drop-index={day.items.length}><button disabled={blocked} onClick={() => { setEditor({}); setMoveItem(null) }}><Icon name="plus" size={18} />Add a little something<span>An experience, a meal, or room to breathe</span></button></div>
        </div>
        {editor && <ItemEditor key={editor.item?.id ?? editor.suggestion?.title ?? 'new'} item={editor.item} suggestion={editor.suggestion} busy={blocked} onClose={() => setEditor(null)} onSave={input => apply({ ...input, type: editor.item ? 'update' : 'add', itemId: editor.item?.id, dayId: day.id }, editor.item ? 'Activity updated.' : 'A new moment added.')} />}
        <div ref={bookings} tabIndex={-1} className="canvas-bookings"><TravelPlanningOptions trip={trip ?? plan.bookings ?? { destination: plan.destination, duration_days: plan.days.length, budget: 'Flexible', location_type: '', estimated_cost_usd: 0 }} travelDna={travelDna} /></div>
        <p className="canvas-footnote"><Icon name="compass" size={15} />A draft to make your own. Check opening hours, travel times and costs before you go.</p>
      </section>
      <aside ref={side} className={`canvas-panel ${panel ? 'is-open' : ''}`} aria-label="Planning tools" role={compact && panel ? 'dialog' : undefined} aria-modal={compact && panel ? true : undefined}>
        <div className="canvas-panel-tabs">{(['ideas', 'companion', 'crew'] as Panel[]).map(value => <button key={value} onClick={() => showPanel(value)} aria-pressed={panel === value}><Icon name={value === 'ideas' ? 'compass' : value === 'companion' ? 'spark' : 'people'} size={16} />{value === 'ideas' ? 'Ideas' : value === 'companion' ? 'Companion' : solo ? 'Notes' : 'Crew'}{value === 'crew' && unread > 0 && <b>{unread}</b>}</button>)}<button className="canvas-panel-close" aria-label="Close planning panel" onClick={() => showPanel(null)}><Icon name="close" size={17} /></button></div>
        <div hidden={panel !== 'ideas'} className="canvas-panel-body"><p className="canvas-kicker">LEAVE ROOM FOR A DETOUR</p><h2>A little <em>inspiration.</em></h2><p>{readOnly ? `Things to do in ${plan.destination}. Suggest one to your crew and your host can add it.` : `Things to do in ${plan.destination}. Add one to a day, then make it your own.`}</p><CustomIdea readOnly={readOnly} blocked={blocked} onAdd={title => { setEditor({ suggestion: { title, kind: 'experience', note: '' } }); if (window.innerWidth <= 900) setPanel(null); window.requestAnimationFrame(() => document.querySelector('.canvas-item-editor')?.scrollIntoView({ block: 'center' })) }} onSuggest={title => { setCrewContext({ label: `Idea · ${title}`, detail: 'A custom activity suggestion' }); openPanel('crew') }} />{preview ? <div className="canvas-idea-photo"><img src={image} srcSet={coverSrcSet} sizes="320px" alt={plan.destination} onError={coverError} /><span><Icon name="plane" size={16} />Wish we were here.</span></div> : panel === 'ideas' && <AreaIdeas roomId={roomId} destination={plan.destination} moods={travelDna?.sharedVibe ?? []} blocked={blocked} readOnly={readOnly} onAddFree={() => { setEditor({ suggestion: ideaItems[1] }); if (window.innerWidth <= 900) setPanel(null); window.requestAnimationFrame(() => document.querySelector('.canvas-item-editor')?.scrollIntoView({ block: 'center' })) }} onAdd={idea => { setEditor({ suggestion: { title: idea.title, kind: idea.kind, placeId: idea.placeSource?.placeId, note: [idea.note, idea.area && `Area: ${idea.area}.`, 'Check opening hours and availability.'].filter(Boolean).join(' ') } }); if (window.innerWidth <= 900) setPanel(null); window.requestAnimationFrame(() => document.querySelector('.canvas-item-editor')?.scrollIntoView({ block: 'center' })) }} onSuggest={idea => { setCrewContext({ label: `Idea · ${idea.title}`, detail: [idea.note, idea.area].filter(Boolean).join(' · ') }); openPanel('crew') }} />}{!readOnly && <p className="canvas-kicker canvas-quick-kicker">QUICK ADDITIONS</p>}{(!readOnly ? ideaItems : []).map(idea => <article className={`canvas-idea kind-${idea.kind}`} key={idea.title}><span><Icon name={types[idea.kind].icon} size={20} /></span><div><strong>{idea.title}</strong><small>{idea.kind === 'free' ? 'A little space in your day' : 'Idea · details to research'}</small></div><button disabled={blocked} aria-label={`Add ${idea.title}`} onClick={() => { setEditor({ suggestion: idea }); if (window.innerWidth <= 900) setPanel(null); window.requestAnimationFrame(() => document.querySelector('.canvas-item-editor')?.scrollIntoView({ block: 'center' })) }}><Icon name="plus" size={17} /></button></article>)}{extraIdeas && <details className="canvas-shortlist"><summary>{solo ? 'My saved ideas' : 'Saved picks & crew shortlist'}</summary>{extraIdeas((label, detail) => { setCrewContext({ label, detail }); openPanel('crew') })}</details>}</div>
        <div hidden={panel !== 'companion'} className="canvas-panel-body canvas-companion-body"><div className="canvas-privacy"><Icon name="lock" size={13} />PRIVATE · ONLY YOU</div>{context && <button className="canvas-plain" onClick={() => setContext(null)}>Clear attached activity <Icon name="close" size={13} /></button>}{renderCompanion(context, day.id)}</div>
        <div hidden={panel !== 'crew'} className="canvas-crew-body"><div className="canvas-privacy"><Icon name="people" size={13} />{solo ? 'NOTES FOR THIS TRIP' : 'SHARED · YOUR CREW'}</div>{renderCrew(panel === 'crew', crewContext, () => setCrewContext(null), () => showPanel(null))}</div>
      </aside>
    </div>
    </div>
    <nav className="canvas-dock" aria-label="Workspace tools" hidden={focusMode}><button onClick={() => { showPanel(null); dayHeading.current?.focus({ preventScroll: true }) }} aria-pressed={!panel}><Icon name="calendar" size={18} />The plan</button>{(['ideas', 'companion', 'crew'] as Panel[]).map(value => <button key={value} onClick={() => openPanel(value)} aria-pressed={panel === value}><Icon name={value === 'ideas' ? 'compass' : value === 'companion' ? 'spark' : 'people'} size={18} />{value === 'ideas' ? 'Ideas' : value === 'companion' ? 'Companion' : solo ? 'Notes' : 'Crew'}{value === 'crew' && unread > 0 && <b>{unread}</b>}</button>)}</nav>
    <div className="canvas-announcement" role="status">{announcement}</div>
  </section>
}

function ConfirmRow({ people, memberCount, onToggle, disabled }: { disabled: boolean; people: Array<{ name: string; isMe: boolean }>; memberCount: number; onToggle: (confirmed: boolean) => void }) {
  const mine = people.some(person => person.isMe)
  const names = people.map(person => person.isMe ? 'You' : person.name)
  return <div className={`canvas-confirm ${mine ? 'is-in' : ''}`}>
    <button type="button" aria-pressed={mine} disabled={disabled} onClick={() => onToggle(!mine)}><Icon name="check" size={14} />{mine ? "You're in" : "I'm in"}</button>
    <span>{people.length ? `${people.length}${memberCount ? ` of ${memberCount}` : ''} in · ${names.join(', ')}` : 'No one has confirmed yet'}</span>
  </div>
}

function CustomIdea({ readOnly, blocked, onAdd, onSuggest }: { readOnly: boolean; blocked: boolean; onAdd: (title: string) => void; onSuggest: (title: string) => void }) {
  const [title, setTitle] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = title.trim()
    if (!value) return
    if (readOnly) onSuggest(value); else onAdd(value)
    setTitle('')
  }
  return <form className="canvas-idea-custom" onSubmit={submit}>
    <label htmlFor="custom-activity"><Icon name="plus" size={14} />{readOnly ? 'Suggest your own idea' : 'Write your own'}</label>
    <div><input id="custom-activity" value={title} onChange={event => setTitle(event.target.value)} placeholder="Birthday dinner, a friend's café, a lazy morning…" maxLength={100} /><button type="submit" disabled={!title.trim() || (!readOnly && blocked)}>{readOnly ? 'Suggest' : 'Add'}</button></div>
  </form>
}

const categoryIcons: Record<string, string> = { breakfast: 'sun', downtime: 'leaf', local: 'spark', wander: 'compass', sights: 'pin', culture: 'heart', evening: 'moon', daytrip: 'plane' }
const moodCategories: Record<string, string[]> = {
  'Food & Culture': ['breakfast', 'evening', 'local', 'culture'], Relaxation: ['downtime', 'breakfast', 'wander'], Adventure: ['daytrip', 'sights'],
  Nature: ['downtime', 'daytrip'], Nightlife: ['evening'], Wellness: ['downtime'], Shopping: ['wander'], History: ['culture', 'sights'], 'Family fun': ['sights', 'local'],
}

function AreaIdeas({ roomId, destination, moods, blocked, readOnly, onAdd, onAddFree, onSuggest }: { roomId: string; destination: string; moods: string[]; blocked: boolean; readOnly: boolean; onAdd: (idea: AreaIdea) => void; onAddFree: () => void; onSuggest: (idea: AreaIdea) => void }) {
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [request, setRequest] = useState(0)
  const [ideas, setIdeas] = useState<AreaIdea[] | null>(null)
  const [categories, setCategories] = useState<IdeaCategory[]>([])
  const [expanded, setExpanded] = useState<string[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getAreaIdeas(roomId, destination, search).then(value => { if (active) { setIdeas(value.ideas); setCategories(value.categories ?? []); setError(value.ideas.length ? '' : 'Place ideas are unavailable right now. Write your own or use a quick addition below.') } }).catch(() => { if (active) { setIdeas([]); setError('Ideas could not load just now. Try again.') } })
    return () => { active = false }
  }, [roomId, destination, search, request])
  const submit = (event: FormEvent) => { event.preventDefault(); setIdeas(null); setError(''); setSearch(input.trim()); setRequest(value => value + 1) }
  const clear = () => { setInput(''); setIdeas(null); setSearch(''); setRequest(value => value + 1) }
  const priority = moods.flatMap(mood => moodCategories[mood] ?? [])
  const ordered = [...categories].sort((a, b) => (priority.indexOf(a.id) === -1 ? 99 : priority.indexOf(a.id)) - (priority.indexOf(b.id) === -1 ? 99 : priority.indexOf(b.id)))
  const row = (idea: AreaIdea) => <AreaIdeaRow key={idea.title} idea={idea} destination={destination} blocked={blocked} readOnly={readOnly} onAdd={onAdd} onSuggest={onSuggest} />
  return <div className="canvas-area-ideas">
    {ideas?.some(idea => idea.placeSource) && <p className="canvas-source-context">Places from official sources. Add one to your day with its source link, then adjust the timing.</p>}
    <form onSubmit={submit} className="canvas-idea-search"><input aria-label={`Search things to do in ${destination}`} value={input} onChange={event => setInput(event.target.value)} placeholder="Search: ramen, rainy day, kids…" maxLength={80} /><button type="submit" aria-label="Search ideas"><Icon name="spark" size={15} /></button></form>
    {ideas === null ? <p className="canvas-idea-loading">Finding things to do in {destination}{search ? ` for “${search}”` : ''}…</p>
      : search ? <>
        <div className="canvas-idea-results"><span>Results for “{search}”</span><button type="button" onClick={clear}>Back to categories</button></div>
        {error && <p className="canvas-idea-loading">{error} <button type="button" className="canvas-idea-more" onClick={() => { setIdeas(null); setError(''); setRequest(value => value + 1) }}>Retry ideas</button></p>}{ideas.map(row)}
      </> : <>
        {error && <p className="canvas-idea-loading">{error} <button type="button" className="canvas-idea-more" onClick={() => { setIdeas(null); setError(''); setRequest(value => value + 1) }}>Retry ideas</button></p>}
        {ordered.map((category, index) => {
          const items = ideas.filter(idea => idea.category === category.id)
          if (!items.length) return null
          const open = expanded.includes(category.id)
          return <details className="canvas-idea-category" key={category.id} open={index < 2}>
            <summary><span className="canvas-idea-category-icon"><Icon name={categoryIcons[category.id] ?? 'compass'} size={17} /></span><span><strong>{category.label}</strong><small>{items.length} {items.length === 1 ? 'idea' : 'ideas'} · {category.hint}</small></span><Icon name="plus" size={14} /></summary>
            {category.id === 'downtime' && !readOnly && <button type="button" className="canvas-idea-free" disabled={blocked} onClick={onAddFree}><Icon name="leaf" size={14} />Leave time free, no plans</button>}
            {(open ? items : items.slice(0, 4)).map(row)}
            {items.length > 4 && <button type="button" className="canvas-idea-more" onClick={() => setExpanded(value => open ? value.filter(id => id !== category.id) : [...value, category.id])}>{open ? 'Show fewer' : `Show ${items.length - 4} more`}</button>}
          </details>
        })}
      </>}
  </div>
}

function AreaIdeaRow({ idea, destination, blocked, readOnly, onAdd, onSuggest }: { idea: AreaIdea; destination: string; blocked: boolean; readOnly: boolean; onAdd: (idea: AreaIdea) => void; onSuggest: (idea: AreaIdea) => void }) {
  const { src, srcSet, ref, onError, description, alt } = usePlacePhoto({ placeId: idea.placeSource?.placeId, title: idea.title, destination, imageQuery: idea.imageQuery, area: idea.area, kind: idea.kind })
  return <article className={`canvas-idea canvas-area-idea kind-${idea.kind}`}>
    <img src={src} srcSet={srcSet} sizes="(max-width: 700px) 90vw, 640px" ref={ref} alt={alt} loading="lazy" decoding="async" onError={onError} />
    <div><strong>{idea.title}</strong><PlacePhotoCaption description={description} /><small>{[idea.area, idea.note].filter(Boolean).join(' · ')}</small>{idea.placeSource ? <PlaceSourceNote source={idea.placeSource} /> : <small>AI suggestion · details to verify</small>}</div>
    {readOnly ? <button type="button" aria-label={`Suggest ${idea.title} to your crew`} title="Suggest to your crew" onClick={() => onSuggest(idea)}><Icon name="chat" size={16} /></button> : <button type="button" disabled={blocked} aria-label={`Add ${idea.title}`} onClick={() => onAdd(idea)}><Icon name="plus" size={17} /></button>}
  </article>
}

function ActivityPhoto({ title, imageQuery, destination, placeId, kind }: { title: string; imageQuery?: string; destination: string; placeId?: string; kind?: string }) {
  const { src, srcSet, ref, onError, description, alt } = usePlacePhoto({ placeId, title, destination, imageQuery, kind })
  return <><img className="canvas-activity-photo" src={src} srcSet={srcSet} sizes="(max-width: 700px) 90vw, 640px" ref={ref} alt={alt} loading="lazy" decoding="async" onError={onError} /><PlacePhotoCaption description={description} /></>
}

function ItemEditor({ item, suggestion, busy, onClose, onSave }: { item?: PlanItem; suggestion?: typeof ideaItems[number]; busy: boolean; onClose: () => void; onSave: (input: PlanCommand) => Promise<boolean> }) {
  const title = useRef<HTMLInputElement>(null)
  useEffect(() => { title.current?.focus({ preventScroll: true }); title.current?.scrollIntoView({ block: 'center', behavior: 'instant' }) }, [])
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    void onSave({ type: item ? 'update' : 'add', title: String(values.get('title')), kind: String(values.get('kind')) as PlanItem['kind'], time: String(values.get('time')), duration: Number(values.get('duration')), note: String(values.get('note')), placeId: suggestion?.placeId })
  }
  return <form className="canvas-item-editor" onSubmit={submit} aria-label={item ? 'Edit activity' : 'Add an activity'}><div><p className="canvas-kicker">{item ? 'MAKE THIS MOMENT YOURS' : 'A LITTLE SOMETHING EXTRA'}</p><button type="button" aria-label="Close activity editor" onClick={onClose}><Icon name="close" size={17} /></button></div><label>What shall we do?<input ref={title} name="title" required maxLength={180} defaultValue={item?.title ?? suggestion?.title ?? ''} placeholder="A long lunch, a hidden bookshop…" /></label><div className="canvas-editor-grid"><label>Type<select name="kind" defaultValue={item?.kind ?? suggestion?.kind ?? 'experience'}>{Object.entries(types).map(([value, type]) => <option value={value} key={value}>{type.label}</option>)}</select></label><label>Suggested time<input type="time" name="time" required defaultValue={item?.time ?? '12:00'} /></label><label>Minutes<input type="number" name="duration" required min={15} max={720} step={1} defaultValue={item?.duration ?? 60} /></label></div><label>A note, if you like<textarea name="note" rows={2} maxLength={1000} defaultValue={item?.note ?? suggestion?.note ?? ''} placeholder="Something worth remembering…" /></label><footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Saving…' : item ? 'Save this moment' : 'Add to this day'}<Icon size={16} /></button></footer></form>
}
