import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuests } from '../hooks/useQuests'
import { useQuestRecommendations } from '../hooks/useQuestRecommendations'
import { EmptyState, ErrorState, Icon, LoadingState } from '../components/Ui'
import { PlanningCompanion } from '../components/PlanningCompanion'
import { LearningNudge } from '../components/LearningNudge'
import type { LearningPrompt } from '../services/travelMemoryApi'
import { QuestChat } from '../components/QuestChat'
import { QuestShortlist } from '../components/QuestShortlist'
import { QuestInviteDialog } from '../components/QuestInviteDialog'
import { TripCanvas } from '../components/TripCanvas'
import { getWorkingPlan, savePlanChange, startWorkingPlan, type PlanCommand, type WorkingPlan } from '../services/workingPlanApi'
import { recommendationPhoto } from '../services/itineraryPresentation'
import type { Quest } from '../apis/quests'

export function QuestDetailPage() {
  const { roomId = '' } = useParams()
  const { quests, loading, error, retry } = useQuests()
  const quest = quests.find(item => item.id === roomId)
  if (loading) return <LoadingState label="Opening your travel book…" />
  if (error) return <ErrorState message={error} retry={retry} />
  if (!quest) return <EmptyState title="This quest isn’t in your travel book." description="It may be unavailable, or you may need to accept an invitation first." to="/trips" label="Back to my quests" />
  return <QuestWorkspace key={roomId} quest={quest} />
}

function QuestWorkspace({ quest }: { quest: Quest }) {
  const roomId = quest.id
  const { data, error: ideasError, retry } = useQuestRecommendations(roomId)
  const [learning, setLearning] = useState<LearningPrompt | null>(null)
  const [plan, setPlan] = useState<WorkingPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [retryable, setRetryable] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [reload, setReload] = useState(0)
  const inFlight = useRef(false)
  const pending = useRef<{ command: PlanCommand; requestId: string; revision: number } | null>(null)
  useEffect(() => {
    let active = true
    getWorkingPlan(roomId).then(value => { if (active) { setPlan(value); setError(''); setRetryable(false); pending.current = null } }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'We could not open the saved plan.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [roomId, reload])
  const change = async (command: PlanCommand, retrying = false) => {
    if (!plan || inFlight.current) return false
    inFlight.current = true; setSaving(true); setError('')
    const request = retrying && pending.current ? pending.current : { command, revision: plan.revision, requestId: crypto.randomUUID() }
    pending.current = request
    try { const saved = await savePlanChange(roomId, request.revision, request.requestId, request.command); setPlan(saved); setLearning(saved.learningPrompt ?? null); pending.current = null; setRetryable(false); return true }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'This change could not be saved.'); setRetryable(true); return false }
    finally { inFlight.current = false; setSaving(false) }
  }
  const start = async (id: string) => {
    if (inFlight.current) return
    inFlight.current = true; setSaving(true); setError('')
    try { setPlan(await startWorkingPlan(roomId, id)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'This plan could not be saved.') }
    finally { inFlight.current = false; setSaving(false) }
  }
  if (loading) return <LoadingState label="Opening your saved itinerary…" />
  if (!plan) return <section className="canvas-start"><Link className="back-link" to="/trips">← All your quests</Link><p className="canvas-kicker">{quest.name}</p><h1>A starting point.<br /><em>A world of possibilities.</em></h1><p>Choose an idea. Then move, replace, and make every day your own.</p>{error && <ErrorState message={error} retry={() => setReload(value => value + 1)} />}{ideasError ? <ErrorState message={ideasError} retry={retry} /> : !data ? <LoadingState label="Gathering your starting points…" /> : <>{data.blockers?.map(message => <p className="canvas-warning" key={message}>{message}</p>)}<div className="canvas-start-options">{data.results.map(trip => <article key={trip.id}><img src={recommendationPhoto(trip)} alt={`${trip.destination} inspiration`} /><div><p className="canvas-kicker">{trip.label}</p><h2>{trip.destination}</h2><p>{trip.short_description}</p><small>{trip.duration_days} days · {trip.budget}</small><button className="primary-button" disabled={saving || quest.role !== 'owner'} onClick={() => void start(trip.id)}>Make this our plan <Icon /></button></div></article>)}</div>{!data.results.length && <Link className="primary-button" to={`/travel-dna/preferences?roomId=${roomId}`}>Adjust my travel preferences <Icon /></Link>}{quest.role !== 'owner' && <p>Your host can choose the shared starting plan.</p>}</>}</section>
  return <><TripCanvas plan={plan} roomId={roomId} saving={saving} error={error} status={error ? 'Your last saved plan is safe' : 'Saved to your quest'} readOnly={quest.role !== 'owner'} onChange={change} onRetry={retryable ? () => pending.current ? change(pending.current.command, true) : Promise.resolve(false) : undefined} onReload={() => setReload(value => value + 1)} onInvite={quest.role === 'owner' ? () => setInviteOpen(true) : undefined} preferencesUrl={`/travel-dna/preferences?roomId=${roomId}`} unread={unread}
    learning={learning && <LearningNudge key={learning.eventId} suggestion={learning} onClose={() => setLearning(null)} />}
    renderCompanion={(context, dayId) => <PlanningCompanion roomId={roomId} plan={plan} dayId={dayId} context={context} readOnly={quest.role !== 'owner'} onChange={change} />}
    renderCrew={(open, context, clear, close) => <QuestChat roomId={roomId} embedded open={open} onClose={close} focusRequest={0} context={context} onClearContext={clear} onUnreadChange={setUnread} onQuestNoteApplied={retry} />}
    extraIdeas={discuss => <><QuestShortlist roomId={roomId} onDiscuss={discuss} /><Link className="canvas-plain" to={`/travel-dna/plan-paths?roomId=${roomId}`}>Explore other starting points <Icon size={15} /></Link><Link className="canvas-plain" to={`/travel-dna/group-dna?roomId=${roomId}`}>Our Travel DNA <Icon size={15} /></Link></>}
  /><QuestInviteDialog roomId={roomId} open={inviteOpen} onClose={() => setInviteOpen(false)} /></>
}
