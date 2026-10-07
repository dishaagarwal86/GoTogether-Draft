import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuests } from '../hooks/useQuests'
import { useQuestJourney } from '../hooks/useQuestJourney'
import { GroupOptions, GroupResponses } from '../components/GroupOptions'
import { MemberPreferences } from '../components/MemberPreferences'
import { useAuth } from '../auth/AuthContext'
import { RoomTravelMode, type TravelMode } from '../components/TravelModeSwitch'
import { SoloOverview } from '../components/SoloOverview'
import { changeTravelMode, manageCrew, respondToJourney, type JourneyVote } from '../apis/quests'
import { EmptyState, ErrorState, Icon, LoadingState } from '../components/Ui'
import { PlanningCompanion } from '../components/PlanningCompanion'
import { LearningNudge } from '../components/LearningNudge'
import type { LearningPrompt } from '../services/travelMemoryApi'
import { QuestChat } from '../components/QuestChat'
import { QuestShortlist } from '../components/QuestShortlist'
import { QuestInviteDialog } from '../components/QuestInviteDialog'
import { TripCanvas } from '../components/TripCanvas'
import { getWorkingPlan, savePlanChange, startWorkingPlan, type PlanCommand, type WorkingPlan } from '../services/workingPlanApi'
import type { Quest } from '../apis/quests'

export function QuestDetailPage() {
  const { roomId = '' } = useParams()
  const { quests, loading, error, retry } = useQuests()
  // Start the room's largest read alongside membership loading, rather than
  // paying for another network round trip after the room list has arrived.
  const journey = useQuestJourney(roomId)
  const quest = quests.find(item => item.id === roomId)
  if (loading) return <LoadingState label="Opening your travel book…" />
  if (error) return <ErrorState message={error} retry={retry} />
  if (!quest) return <EmptyState title="This quest isn’t in your travel book." description="It may be unavailable, or you may need to accept an invitation first." to="/trips" label="Back to my quests" />
  return <QuestWorkspace key={roomId} quest={quest} refreshRooms={retry} journey={journey} />
}


type RoomTab = 'crew' | 'options' | 'itinerary' | 'ideas' | 'chat'
function QuestWorkspace({ quest, refreshRooms, journey }: { quest: Quest; refreshRooms: () => void; journey: ReturnType<typeof useQuestJourney> }) {
  const roomId = quest.id
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, error: journeyError, retry } = journey
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const tab = (['crew', 'options', 'itinerary', 'ideas', 'chat'].includes(params.get('tab') ?? '') ? params.get('tab') : 'crew') as RoomTab
  const setTab = useCallback((value: RoomTab) => setParams({ tab: value }), [setParams])
  const [showPreferences, setShowPreferences] = useState(false)
  const preferencesOpen = showPreferences || params.get('preferences') === '1'
  const setPreferencesOpen = (open: boolean) => {
    setShowPreferences(open)
    if (!open && params.has('preferences')) setParams(current => { const next = new URLSearchParams(current); next.delete('preferences'); return next }, { replace: true })
  }
  const [learning, setLearning] = useState<LearningPrompt | null>(null)
  const [plan, setPlan] = useState<WorkingPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [retryable, setRetryable] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [reload, setReload] = useState(0)
  const [size, setSize] = useState(String(quest.members))
  const [remove, setRemove] = useState('')
  const [replacement, setReplacement] = useState('')
  const [context, setContext] = useState<{ label: string; detail: string } | null>(location.state?.chatContext ?? null)
  const inFlight = useRef(false)
  const pending = useRef<{ command: PlanCommand; requestId: string; revision: number } | null>(null)
  const initialNavigation = useRef(false)
  const owner = quest.role === 'owner'
  useEffect(() => {
    let active = true; let fetching = false
    const refresh = async () => {
      if (fetching || inFlight.current || document.hidden || pending.current) return
      fetching = true
      try { const value = await getWorkingPlan(roomId); if (active && !inFlight.current && !pending.current) { setPlan(current => current?.revision === value?.revision ? current : value); setLoading(false) } }
      catch (reason) { if (active) { setError(reason instanceof Error ? reason.message : 'The saved itinerary could not load.'); setLoading(false) } }
      finally { fetching = false }
    }
    void refresh(); const timer = window.setInterval(refresh, 6000)
    return () => { active = false; window.clearInterval(timer) }
  }, [roomId, reload])
  useEffect(() => {
    if (loading || !data || initialNavigation.current) return
    initialNavigation.current = true
    if (location.hash === '#crew-chat' || location.state?.chatContext) setTab('chat')
    else if (!params.has('tab') && !params.has('preferences')) setTab(plan ? 'itinerary' : data.ready ? 'options' : 'crew')
  }, [loading, data, plan, params, location.hash, location.state?.chatContext, setTab])
  const change = async (command: PlanCommand, retrying = false) => {
    if (!plan || inFlight.current) return false
    inFlight.current = true; setSaving(true); setError('')
    const request = retrying && pending.current ? pending.current : { command, revision: plan.revision, requestId: crypto.randomUUID() }
    pending.current = request
    try { const saved = await savePlanChange(roomId, request.revision, request.requestId, request.command); setPlan(saved); setLearning(saved.learningPrompt ?? null); pending.current = null; setRetryable(false); retry(); return true }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'This change could not be saved.'); setRetryable(true); return false }
    finally { inFlight.current = false; setSaving(false) }
  }
  const start = async (id: string) => {
    if (plan) { if (await change({ type: 'itinerary', catalogueId: id })) { setReplacement(''); setTab('itinerary') }; return }
    if (inFlight.current) return
    inFlight.current = true; setSaving(true); setError('')
    try { setPlan(await startWorkingPlan(roomId, id)); retry(); setTab('itinerary') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'This plan could not be saved.'); retry() }
    finally { inFlight.current = false; setSaving(false) }
  }
  const respond = async (vote: JourneyVote) => {
    if (inFlight.current) return
    inFlight.current = true; setSaving(true); setError('')
    try { await respondToJourney(roomId, vote); retry() }
    catch (reason) { retry(); throw reason }
    finally { inFlight.current = false; setSaving(false) }
  }
  const crewAction = async (body: Parameters<typeof manageCrew>[1]) => {
    if (inFlight.current) return
    inFlight.current = true; setSaving(true); setError('')
    try { await manageCrew(roomId, body); setRemove(''); retry() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The crew could not update.') }
    finally { inFlight.current = false; setSaving(false) }
  }
  const switchMode = async (mode: TravelMode, requestId: string) => {
    if (inFlight.current || pending.current) throw new Error('Save or retry your itinerary change before switching travel mode.')
    inFlight.current = true; setSaving(true)
    try {
      const result = await changeTravelMode(roomId, mode, requestId)
      navigate(`/quests/${result.roomId}?tab=${mode === 'solo' && plan ? 'itinerary' : 'crew'}`, { state: { modeNotice: result.copied ? 'Your solo copy is ready. Your shared trip is still with the crew.' : mode === 'solo' ? 'You’re travelling solo. Your saved work is right here.' : 'Room for good company. Invite someone to join you.', sourceRoom: result.copied ? roomId : undefined } })
      refreshRooms()
      retry()
    } finally { inFlight.current = false; setSaving(false) }
  }
  const discuss = (label: string, detail: string) => { setContext({ label, detail }); setTab('chat') }
  if (!data) return journeyError ? <ErrorState message={journeyError} retry={retry} /> : <LoadingState label="Opening your shared travel room…" />
  const solo = data.totalMembers === 1
  const mine = data.participants.find(person => person.id === user!.id)
  const agreed = data.planReview?.status === 'agreed'
  const stage = !data.ready ? 0 : !plan ? 1 : agreed ? 3 : 2
  const editPreferences = () => { setPreferencesOpen(true); setTab('crew') }
  return <section className="group-room" aria-label={solo ? 'Solo planning room' : 'Group planning room'}>
    <header className="group-room-cover"><div><Link to="/trips">← Your travel book</Link><p className="eyebrow">{solo ? 'A LITTLE WHAT IF. AN ADVENTURE OF YOUR OWN.' : 'A LITTLE WHAT IF. A SHARED ADVENTURE.'}</p><h1>{quest.name}</h1><p>{solo ? 'A trip that follows your curiosity. Shape every day around you.' : !data.ready ? 'Bring your people. Let everyone leave a little of themselves in the plan.' : agreed ? 'A plan your people have agreed on. A new chapter to look forward to.' : 'Every voice is in. Find your somewhere, together.'}</p><span><Icon name="people" size={16} />{solo ? 'Solo trip · Your own pace' : `${data.memberCount} of ${data.totalMembers} preferences ready · ${owner ? 'You’re hosting' : 'You’re part of the crew'}`}</span></div><div className="group-cover-stamp" aria-hidden="true"><Icon name="plane" size={32} /><span>{solo ? <>YOUR PACE<br />YOUR CHAPTER</> : <>GOOD PLACES<br />BETTER COMPANY</>}</span></div></header>
    <nav className="group-progress" aria-label="Planning progress">{[[solo ? 'Your travel style' : 'Gather your crew', 'crew'], ['Compare options', 'options'], ['Shape your itinerary', 'itinerary'], [solo ? 'Ready to go' : 'Review together', 'itinerary']].map(([label, target], index) => <button key={label} aria-current={stage === index ? 'step' : undefined} className={stage > index ? 'is-complete' : ''} onClick={() => setTab(target as RoomTab)}><span>{stage > index ? <Icon name="check" size={15} /> : `0${index + 1}`}</span><strong>{label}</strong></button>)}</nav>
    {owner && <RoomTravelMode roomId={roomId} solo={solo} hasOthers={data.participants.some(person => person.id !== user!.id)} busy={saving || retryable} onChange={switchMode} />}
    {location.state?.modeNotice && <p className="mode-notice" role="status"><Icon name="check" size={17} />{location.state.modeNotice}{location.state.sourceRoom && <Link to={`/quests/${location.state.sourceRoom}`}>Open shared trip ↗</Link>}</p>}
    <div className="group-room-toolbar"><nav aria-label="Room sections">{([['crew', solo ? 'Your trip' : 'Your crew', 'people'], ['options', 'Compare options', 'compass'], ['itinerary', solo ? 'My itinerary' : 'Our itinerary', 'calendar'], ['ideas', 'Saved ideas', 'heart'], ['chat', solo ? 'Trip notes' : 'Crew chat', 'chat']] as const).map(([key, label, icon]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}><Icon name={icon} size={17} />{label}{key === 'chat' && unread > 0 && <b>{unread}</b>}</button>)}</nav>{owner && !solo && <button className="group-invite-button" onClick={() => setInviteOpen(true)}><Icon name="plus" size={17} />Invite</button>}</div>
    {(journeyError || error && (tab !== 'itinerary' || !plan)) && <div className="group-error" role="alert">{error || journeyError}<button onClick={() => { setError(''); retry(); setReload(value => value + 1) }}>Refresh room</button></div>}
    {tab === 'crew' && <div className="group-gathering">{preferencesOpen ? <MemberPreferences solo={solo} roomId={roomId} name={quest.name} onClose={() => setPreferencesOpen(false)} onSaved={() => { setPreferencesOpen(false); retry() }} /> : solo ? <SoloOverview roomId={roomId} ready={data.ready} hasPlan={Boolean(plan)} edit={editPreferences} openOptions={() => setTab('options')} openPlan={() => setTab('itinerary')} openIdeas={() => setTab('ideas')} /> : <><div className="group-gather-main"><p className="eyebrow">THE GOOD PART IS THE TOGETHER PART</p><h2>{data.ready ? <>Every voice.<br /><em>One shared story.</em></> : <>First, the people.<br /><em>Then, the places.</em></>}</h2><p>{data.ready ? 'Your crew’s preferences are included. Explore the matches and respond to the options that feel right.' : 'Everyone adds their own travel style. We’ll find your group’s matches when all the voices are in.'}</p><div className="group-progress-track"><span style={{ width: `${data.memberCount / data.totalMembers * 100}%` }} /></div><p className="group-live-status" role="status"><span />{data.memberCount} of {data.totalMembers} ready · Updates automatically</p><div className="group-next-actions">{mine?.status !== 'ready' ? <button className="primary-button" onClick={editPreferences}>Share my travel style<Icon /></button> : <><span className="group-ready-note"><Icon name="check" size={17} />Your preferences are included.</span><button className="secondary-button" onClick={editPreferences}>Review my preferences<Icon name="sliders" size={16} /></button></>}{data.ready && <button className="primary-button" onClick={() => setTab('options')}>Compare group options<Icon /></button>}</div><div className="group-while-waiting"><Icon name="camera" size={26} /><div><h3>A little inspiration while we gather.</h3><p>Pin a place, share a must-do, or start the conversation.</p><button onClick={() => setTab('ideas')}>Open saved ideas ↗</button><button onClick={() => setTab('chat')}>Talk with the crew ↗</button><Link to={`/explore?roomId=${encodeURIComponent(roomId)}`}>Browse all itineraries ↗</Link></div></div></div><aside className="group-crew-card"><header><p className="eyebrow">YOUR TRAVELLERS</p><strong>{data.totalMembers} places in this chapter</strong></header><div className="group-roster">{data.participants.map(person => <article key={person.id}><span className={`group-person-icon is-${person.status}`}>{person.name.slice(0, 1)}</span><div><strong>{person.id === user!.id ? `${person.name} (you)` : person.name}</strong><small>{person.role === 'owner' ? 'Host · ' : ''}{({ ready: 'Preferences ready', joined: 'Joined · preferences to share', invited: 'Invitation sent', expired: 'Invitation expired' })[person.status]}</small></div>{owner && person.role !== 'owner' && <button aria-label={`Remove ${person.name}`} onClick={() => setRemove(person.id)}><Icon name="close" size={14} /></button>}</article>)}{Array.from({ length: Math.max(0, data.totalMembers - data.participants.length) }, (_, index) => <article key={`space-${index}`} className="group-empty-seat"><span className="group-person-icon"><Icon name="plus" size={18} /></span><div><strong>A place for someone good</strong><small>{owner ? 'Ready for an invitation' : 'Your host can invite another traveller'}</small></div></article>)}</div>{owner && <><button className="secondary-button" onClick={() => setInviteOpen(true)}>Invite your people<Icon name="people" size={16} /></button><details className="group-manage"><summary>Manage the crew</summary><label>Expected travellers, including you<input type="number" min={Math.max(2, data.participants.length)} max="60" value={size} onChange={event => setSize(event.target.value)} /></label><button disabled={saving} onClick={() => void crewAction({ action: 'resize', members: Number(size) })}>Update group size</button><p>Only lower this when someone is no longer travelling. Missing responses never count as agreement.</p></details></>}{remove && <div className="group-inline-confirm"><p>Remove this traveller? Their responses stop counting. Update the expected group size separately if they are no longer coming.</p><button disabled={saving} onClick={() => void crewAction({ action: 'remove', participantId: remove })}>Remove traveller</button><button onClick={() => setRemove('')}>Keep them</button></div>}</aside></>}</div>}
    {tab === 'options' && <>{replacement && <div className="group-inline-confirm" role="alert"><p>{solo ? 'Replace the current itinerary with this option?' : 'Replace the current itinerary with this agreed option?'} Your current edits move into undo history. Locked activities must be unlocked first.</p><button disabled={saving} onClick={() => void start(replacement)}>{solo ? 'Replace my itinerary' : 'Replace our itinerary'}</button><button onClick={() => setReplacement('')}>{solo ? 'Keep my current plan' : 'Keep our current plan'}</button></div>}<GroupOptions roomId={roomId} journey={data} busy={saving} onRespond={respond} onChoose={owner ? id => plan ? setReplacement(id) : void start(id) : undefined} currentId={plan?.catalogueId} onDiscuss={discuss} /></>}
    {tab === 'ideas' && <div className="group-ideas"><Link className="text-button" to={`/explore?roomId=${encodeURIComponent(roomId)}`}>Browse the whole itinerary collection <Icon /></Link><QuestShortlist solo={solo} roomId={roomId} onDiscuss={discuss} /></div>}
    {tab !== 'itinerary' && <div className="group-room-chat" hidden={tab !== 'chat'}><QuestChat solo={solo} roomId={roomId} embedded open={tab === 'chat'} onClose={() => setTab('crew')} focusRequest={0} context={context} onClearContext={() => setContext(null)} onUnreadChange={setUnread} onQuestNoteApplied={retry} /></div>}
    {tab === 'itinerary' && (loading ? <LoadingState label="Opening your saved itinerary…" /> : !plan ? <div className="group-empty"><Icon name="calendar" size={34} /><h2>Your next chapter<br /><em>takes shape here.</em></h2><p>{solo ? data.ready ? 'Pick an itinerary that feels right, then make each day your own.' : 'Add your travel style, then explore itineraries matched to you.' : data.ready ? 'Compare the options, share your response, and let your host choose the itinerary your crew agrees on.' : 'Your itinerary starts with everyone’s preferences. Gather the crew first, then compare your shared matches.'}</p><button className="primary-button" onClick={() => setTab(data.ready ? 'options' : 'crew')}>{data.ready ? solo ? 'Explore my options' : 'Compare group options' : solo ? 'Back to my trip' : 'Back to your crew'}<Icon /></button></div> : <><section className={`group-plan-review${agreed ? ' is-agreed' : ''}`}><div><p className="eyebrow">{solo ? agreed ? 'YOUR NEXT CHAPTER IS READY' : 'YOUR PLAN, YOUR FINAL LOOK' : agreed ? 'AGREED BY YOUR CREW' : 'A SHARED DRAFT, READY TO REVIEW'}</p><h2>{solo ? agreed ? 'Ready when you are.' : 'Take a look. Make it yours.' : agreed ? 'Everyone is on board.' : 'Does this plan work for you?'}</h2><p>{solo ? agreed ? 'This version is marked ready. Confirm bookings, prices and opening hours before you travel.' : !data.ready ? 'Confirm your travel preferences to finish reviewing this plan. Your saved itinerary is right here.' : data.planReview?.preferencesChanged ? 'Your preferences changed. Check this itinerary against your latest needs.' : 'Shape the days below. Mark this version ready whenever it feels right; you can keep editing afterwards.' : agreed ? 'This version is agreed. Bookings, prices, opening hours and travel times still need confirming.' : !data.ready ? 'A traveller still needs to confirm preferences. Your saved itinerary is safe while the crew catches up.' : data.planReview?.preferencesChanged ? 'The group’s preferences changed. Review the saved itinerary against your latest needs before agreeing again.' : 'Review the days below, then respond. Editing the itinerary asks everyone to review the new version.'}</p></div>{data.planReview?.canConfirm ? solo ? <button className="secondary-button" disabled={saving || agreed} onClick={() => void respond({ kind: 'plan', version: data.planReview!.version, reaction: 'works' }).catch(reason => setError(reason instanceof Error ? reason.message : 'Your review could not save.'))}>{agreed ? 'This version is ready' : 'Mark this version ready'}<Icon name="check" size={17} /></button> : <GroupResponses key={data.planReview.version} response={data.planReview} busy={saving} onRespond={(reaction, note) => respond({ kind: 'plan', version: data.planReview!.version, reaction, note })} /> : <button className="secondary-button" onClick={() => setTab(data.ready ? 'options' : 'crew')}>{data.ready ? 'Review matching options' : solo ? 'Review my preferences' : 'Review crew readiness'}<Icon /></button>}</section><TripCanvas solo={solo} plan={plan} roomId={roomId} saving={saving} error={error} status={agreed ? solo ? 'Ready to go · saved' : 'Agreed by the crew · saved' : solo ? 'Saved to your trip' : 'Saved to your quest'} readOnly={!owner} onChange={change} onRetry={retryable ? () => pending.current ? change(pending.current.command, true) : Promise.resolve(false) : undefined} onReload={() => { pending.current = null; setRetryable(false); setReload(value => value + 1) }} onInvite={owner && !solo ? () => setInviteOpen(true) : undefined} preferencesUrl={`/quests/${roomId}?tab=crew&preferences=1`} unread={unread}
      learning={learning && <LearningNudge key={learning.eventId} suggestion={learning} onClose={() => setLearning(null)} />}
      renderCompanion={(context, dayId) => <PlanningCompanion roomId={roomId} plan={plan} dayId={dayId} context={context} readOnly={!owner} onChange={change} />}
      renderCrew={(open, context, clear, close) => <QuestChat solo={solo} roomId={roomId} embedded open={open} onClose={close} focusRequest={0} context={context} onClearContext={clear} onUnreadChange={setUnread} onQuestNoteApplied={retry} />}
      extraIdeas={discuss => <><button className="secondary-button" onClick={() => setTab('options')}>{solo ? 'Explore all my options' : 'Compare all group options'}<Icon /></button><QuestShortlist solo={solo} roomId={roomId} onDiscuss={discuss} /></>}
    /></>)}
    <QuestInviteDialog roomId={roomId} open={inviteOpen} onClose={() => { setInviteOpen(false); retry() }} />
  </section>
}
