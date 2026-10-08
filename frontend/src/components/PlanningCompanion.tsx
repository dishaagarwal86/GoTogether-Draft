import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CompanionPanel } from './CompanionPanel'
import { Icon } from './Ui'
import { dismissProposal, getProposals, getTravelProfile, proposeChange, type PlanProposal } from '../services/travelMemoryApi'
import type { PlanCommand, WorkingPlan } from '../services/workingPlanApi'

type Context = { label: string; detail: string; dayId?: string }
export function PlanningCompanion({ roomId, plan, dayId, context, readOnly, onChange }: { roomId: string; plan: WorkingPlan; dayId: string; context: Context | null; readOnly: boolean; onChange: (command: PlanCommand) => Promise<boolean> }) {
  const [tab, setTab] = useState<'chat' | 'edit'>('chat')
  const addSuggestion = async (summary: string) => {
    const firstSentence = summary.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0] || 'Companion suggestion'
    const title = firstSentence.replace(/^(?:consider|try|add)\s+/i, '').slice(0, 140)
    return onChange({ type: 'add', dayId: context?.dayId ?? dayId, title, kind: 'experience', time: '15:00', duration: 90, note: `Suggested by Companion: ${summary.slice(0, 700)}` })
  }
  return <><div className="memory-companion-tabs"><button aria-pressed={tab === 'chat'} onClick={() => setTab('chat')}>Talk it through</button><button aria-pressed={tab === 'edit'} onClick={() => setTab('edit')}>Edit the plan <Icon name="spark" size={13} /></button></div><div hidden={tab !== 'chat'}><CompanionPanel roomId={roomId} mode="chat" context={context} onAddToItinerary={readOnly ? undefined : addSuggestion} /></div><div hidden={tab !== 'edit'}>{readOnly ? <p>Your host applies shared changes. Share your idea in Crew.</p> : <PlanSuggestions roomId={roomId} plan={plan} dayId={context?.dayId ?? dayId} onChange={onChange} />}</div></>
}
function PlanSuggestions({ roomId, plan, dayId, onChange }: { roomId: string; plan: WorkingPlan; dayId: string; onChange: (command: PlanCommand) => Promise<boolean> }) {
  const [instruction, setInstruction] = useState('')
  const [job, setJob] = useState<PlanProposal | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const attempt = useRef<{ requestId: string; expectedRevision: number; instruction: string; dayId: string } | null>(null)
  useEffect(() => {
    let active = true
    Promise.all([getProposals(roomId), getTravelProfile()]).then(([jobs, profile]) => { if (active) { setJob(jobs[0] ?? null); setCredits(profile.wallet.credits) } }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Planning tools could not load.') })
    return () => { active = false }
  }, [roomId])
  useEffect(() => {
    if (job?.state !== 'pending') return
    let active = true
    const timer = window.setInterval(() => { getProposals(roomId).then(jobs => { if (active) setJob(jobs.find(value => value.id === job.id) ?? null) }).catch(() => { if (active) setError('Still waiting for this request. Reopen this panel to check again.') }) }, 3000)
    return () => { active = false; window.clearInterval(timer) }
  }, [job?.id, job?.state, roomId])
  const ask = async () => {
    if (busy || !instruction.trim()) return
    setBusy(true); setError('')
    const input = attempt.current?.instruction === instruction.trim() && attempt.current.dayId === dayId && attempt.current.expectedRevision === plan.revision ? attempt.current : { requestId: crypto.randomUUID(), expectedRevision: plan.revision, instruction: instruction.trim(), dayId }
    attempt.current = input
    try { const result = await proposeChange(roomId, input); setJob(result); attempt.current = null; setCredits((await getTravelProfile()).wallet.credits) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Your plan is safe. Please try again.') }
    finally { setBusy(false) }
  }
  const apply = async () => {
    if (!job || busy) return
    setBusy(true)
    const saved = await onChange({ type: 'proposal', proposalId: job.id })
    if (saved) setJob({ ...job, state: 'applied' })
    setBusy(false)
  }
  const dismiss = async () => {
    if (!job || busy) return
    setBusy(true); setError('')
    try { await dismissProposal(roomId, job.id); setJob({ ...job, state: 'dismissed' }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Please try again.') }
    finally { setBusy(false) }
  }
  const stale = job?.base_revision !== plan.revision
  return <section className="plan-suggestions" aria-label="Reviewed AI edits"><p className="canvas-kicker">A SMALL CHANGE. YOUR FINAL SAY.</p><h2>Make room for <em>better.</em></h2><p>Preview suggestions for {plan.days.find(day => day.id === dayId)?.title ?? 'this day'}. Nothing changes until you apply.</p><button className="memory-example" onClick={() => setInstruction('Move unlocked moments one hour later')}>Try: move unlocked moments one hour later <Icon size={14} /></button><label>What would you change?<textarea value={instruction} onChange={event => setInstruction(event.target.value)} rows={3} maxLength={1000} placeholder="A slower afternoon, keeping our favourite stop…" /></label><div className="memory-credit-note"><span>{credits === null ? 'Checking credits…' : `${credits} planning credits available`}</span><Link to="/travel-style?tab=perks">Your perks ↗</Link></div><button className="primary-button" disabled={busy || !instruction.trim() || job?.state === 'pending'} onClick={() => void ask()}>{busy ? 'A little moment…' : 'Preview changes · 1 credit'}<Icon name="spark" size={15} /></button><small>Charged for a valid AI preview. Fallbacks and failed requests are free. Manual editing is always available.</small>{error && <p className="form-error" role="alert">{error}</p>}{job && <div className="plan-proposal" aria-live="polite"><p className="canvas-kicker">{job.state === 'pending' ? 'PREPARING YOUR PREVIEW' : job.data.source === 'fallback' ? 'PLANNING SUGGESTION · NO CREDIT USED' : 'YOUR CHANGE PREVIEW'}</p><p>{job.data.summary ?? job.data.notice ?? 'Your request is saved. You can leave this panel and return.'}</p>{job.data.changes?.map((change, index) => <article key={index}><span>Before</span><p>{change.before}</p><span>After</span><p>{change.after}</p></article>)}{job.state === 'ready' && <><p className="memory-preview-footnote">Check times and practical details after applying. Locked moments stay protected. Undo remains available.</p>{stale && <p role="status">The plan has changed since this preview. Ask for a fresh suggestion.</p>}<div className="memory-action-row"><button className="memory-primary" disabled={busy || stale} onClick={() => void apply()}>Apply these changes</button><button disabled={busy} onClick={() => void dismiss()}>Keep my plan</button></div></>}{job.state === 'applied' && <p role="status"><Icon name="check" size={14} /> Applied to your plan. Use Undo to reverse it.</p>}{job.state === 'dismissed' && <p>Kept your plan as it was.</p>}</div>}</section>
}
