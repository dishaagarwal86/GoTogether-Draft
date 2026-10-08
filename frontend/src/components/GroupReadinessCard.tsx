import { useState, type CSSProperties } from 'react'
import type { QuestJourney } from '../apis/quests'
import { groupReadiness } from '../services/groupReadiness'
import { Icon } from './Ui'
import '../styles/group-readiness.css'

type Target = 'crew' | 'options' | 'itinerary'
export function GroupReadinessCard({ journey, owner, onNavigate, compact = false }: { journey: QuestJourney; owner: boolean; compact?: boolean; onNavigate: (target: Target) => void }) {
  const [expanded, setExpanded] = useState(!compact)
  const state = groupReadiness(journey)
  const { total, preferences, counts, progress, score, chosen, validPlan, agreed, response, leading } = state
  const waitingPreferences = total - preferences
  const blocked = journey.ready && !journey.allResults.length && !journey.generationPending
  const next: { target: Target; label: string; description: string } = !journey.ready
    ? { target: 'crew', label: 'View crew readiness', description: `${waitingPreferences} traveller${waitingPreferences === 1 ? '' : 's'} still need${waitingPreferences === 1 ? 's' : ''} to confirm preferences. Everyone gets a say before matching starts.` }
    : blocked ? { target: 'crew', label: 'Review shared requirements', description: journey.blockers[0] || 'Discuss your shared requirements before choosing an itinerary.' }
    : chosen && !validPlan ? { target: 'options', label: 'Review matching options', description: 'Your saved plan needs checking against the latest group preferences.' }
    : chosen ? { target: 'itinerary', label: agreed ? 'Open our itinerary' : 'Review our itinerary', description: agreed ? 'Everyone has agreed to this version. You can keep shaping the trip together.' : counts.concerns ? 'Talk through the concerns, adjust the plan, and ask everyone to review the updated version.' : 'Your starting point is saved. Everyone reviews the latest itinerary before it is marked agreed.' }
    : response?.agreed ? { target: 'options', label: owner ? 'Choose an agreed option' : 'View the agreed options', description: owner ? 'The crew agrees on a starting point. Choose it to begin shaping the days.' : 'Your crew agrees on a starting point. Your host can now save the shared itinerary.' }
    : { target: 'options', label: 'Compare group options', description: counts.concerns ? 'There are concerns to talk through. Compare the alternatives and share what would help.' : 'Explore the options together. “Love it” and “Works for me” both count as agreement.' }
  const steps: Array<{ title: string; detail: string; target: Target }> = [
    { title: 'Share preferences', detail: `${preferences} of ${total} ready`, target: 'crew' },
    { title: 'Agree on an option', detail: validPlan ? 'Starting point agreed' : chosen ? 'Review shared fit' : `${counts.okay} of ${total} okay`, target: 'options' },
    { title: 'Host chooses', detail: validPlan ? 'Starting point saved' : chosen ? 'Saved · needs review' : 'Choose an agreed option', target: 'options' },
    { title: 'Review the plan', detail: agreed ? 'Everyone is on board' : validPlan ? `${counts.okay} of ${total} okay` : 'After a plan is chosen', target: 'itinerary' },
  ]
  const current = progress.findIndex(value => value < 1)
  const title = chosen ? journey.currentPlan!.title : leading?.title
  const stale = chosen && (!validPlan || journey.planReview?.preferencesChanged && !agreed)
  return <section className={`group-readiness-card${compact ? ' is-compact' : ''}`} aria-label="Quest readiness">
    <header><div><p className="eyebrow">QUEST READINESS · {total} TRAVELLERS</p><h2>{agreed ? 'Everyone is on board.' : compact ? 'Your crew’s progress.' : 'A shared plan, one step at a time.'}</h2><p>{next.description}</p></div><div className="readiness-score"><div className="readiness-ring" style={{ '--readiness': `${score}%` } as CSSProperties} role="progressbar" aria-label="Quest planning readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}><strong>{score}<span>%</span></strong></div><span>Planning progress</span></div></header>
    <div className="readiness-decision"><div><p className="eyebrow">{chosen ? 'SAVED PLAN RESPONSES' : counts.okay > 0 ? 'MOST SUPPORTED OPTION SO FAR' : 'GROUP RESPONSES'}</p><h3>{title || 'Your shared decision starts here'}</h3><p>{chosen ? 'Responses apply to the latest saved version.' : title ? 'These counts belong to this option. Each alternative has its own responses.' : 'Once everyone confirms preferences, compare the options and respond.'}</p></div><div className="readiness-counts" aria-label="Group decision counts"><div className="is-okay"><Icon name="check" size={18} /><strong>{counts.okay}</strong><span>Okay with it</span></div><div className="is-concern"><Icon name="chat" size={18} /><strong>{counts.concerns}</strong><span>Have concerns</span></div><div className="is-waiting"><Icon name="clock" size={18} /><strong>{counts.waiting}</strong><span>Yet to respond</span></div></div></div>
    {stale && <p className="readiness-notice"><Icon name="sliders" size={17} />{journey.planReview?.preferencesChanged ? 'Preferences changed. Earlier agreement does not confirm this version.' : 'Check this saved plan against the current shared requirements before agreeing again.'}</p>}
    {compact && <button type="button" className="readiness-expand" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide planning steps' : 'View planning steps and responses'}<Icon name={expanded ? 'close' : 'plus'} size={16} /></button>}
    <div className="readiness-detail" hidden={!expanded}>
    <ol className="readiness-steps">{steps.map((step, index) => <li key={step.title} className={progress[index] === 1 ? 'is-complete' : current === index ? 'is-current' : ''}><button type="button" onClick={() => onNavigate(step.target)} aria-current={current === index ? 'step' : undefined}><span className="readiness-step-number">{progress[index] === 1 ? <Icon name="check" size={17} /> : index + 1}</span><span><strong>{step.title}</strong><small>{step.detail}</small></span></button></li>)}</ol>
    <footer><details className="readiness-people"><summary>See each traveller’s progress <Icon name="people" size={16} /></summary><ul>{journey.participants.map(person => { const vote = response?.people.find(item => item.id === person.id); return <li key={person.id}><strong>{person.name}{person.role === 'owner' ? ' · Host' : ''}</strong><span>{person.status === 'ready' ? 'Preferences ready' : person.status === 'invited' ? 'Invited' : person.status === 'expired' ? 'Invitation expired' : 'Preferences pending'}</span><span>{vote?.reaction === 'concern' ? 'Has concerns' : vote?.reaction ? 'Okay with it' : 'No response yet'}</span>{vote?.reaction === 'concern' && vote.note && <p>{vote.note}</p>}</li>})}{total > journey.participants.length && <li><span>{total - journey.participants.length} place{total - journey.participants.length === 1 ? '' : 's'} awaiting an invitation</span></li>}</ul></details><button className="secondary-button" type="button" onClick={() => onNavigate(next.target)}>{next.label}<Icon size={17} /></button></footer>
    <details className="readiness-method"><summary>How is readiness calculated?</summary><p>Each step contributes 25%: confirmed preferences, agreement on one starting option, the host saving a matching plan, and agreement on the latest plan. Partial preference and response counts contribute proportionally. Missing responses and concerns never count as agreement. The score reaches 100% only when everyone agrees to the current plan; it measures planning progress, not booking completion or AI accuracy.</p></details>
    </div>
  </section>
}
