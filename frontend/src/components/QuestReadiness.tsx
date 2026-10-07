import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { QuestReadiness as QuestReadinessData } from '../apis/quests'
import { Icon } from './Ui'

// A reusable demo shape for storybook/demo routes before live Group Travel DNA is connected.
export const demoQuestReadiness: QuestReadinessData = {
  totalMembers: 5,
  completedMembers: 4,
  readinessState: 'deciding',
  mainTension: 'One choice is still holding this quest back: stay comfort versus experience budget.',
  recommendedAction: 'Choose your group’s trade-off',
  selectedOption: null,
  explanation: '4 of 5 travellers are aligned. One more voice can still shape the final call.',
  options: [
    { id: 'comfort', title: 'Comfort first', summary: 'Boutique hotel · ₹18,000 per person', detail: 'Keep the stay quality, simplify one paid activity.', outcome: 'This option respects 4 must-haves and stays within the preferred budget for 4 travellers.' },
    { id: 'experiences', title: 'Experience first', summary: 'Apartment stay · ₹14,000 per person', detail: 'Keep the food tour, cooking class, and day excursion.', outcome: 'This option respects 4 must-haves and stays within the preferred budget for 4 travellers.' },
  ],
}

export function QuestReadiness({ readiness, roomId }: { readiness: QuestReadinessData; roomId: string }) {
  const [selectedId, setSelectedId] = useState(readiness.selectedOption)
  const markers = Array.from({ length: Math.max(5, readiness.totalMembers) })
  const selected = readiness.options.find((option) => option.id === selectedId)
  const unlocked = readiness.readinessState === 'unlocked' || (Boolean(selected) && readiness.completedMembers >= readiness.totalMembers)
  const status = unlocked ? 'Quest unlocked ✦' : `${readiness.completedMembers} of ${readiness.totalMembers} traveller${readiness.totalMembers === 1 ? '' : 's'} are aligned`
  const decisionIndex = Math.min(Math.max(readiness.completedMembers, 0), markers.length - 1)

  return <section className={`quest-readiness is-${unlocked ? 'unlocked' : readiness.readinessState}`} aria-labelledby="quest-readiness-title">
    <div className="quest-readiness-topline"><p className="eyebrow">QUEST READINESS</p><span className="quest-readiness-status" aria-live="polite">{status}</span></div>
    <div className="quest-readiness-intro"><div><h2 id="quest-readiness-title">{unlocked ? <>Your quest is <em>unlocked.</em></> : <>Your group is almost <em>there.</em></>}</h2><p>{unlocked ? 'Your group has found a plan everyone can live with.' : 'One thoughtful choice can turn a good idea into a shared plan.'}</p></div><span className="quest-readiness-compass" aria-hidden="true"><Icon name={unlocked ? 'check' : 'compass'} size={23} /></span></div>

    <div className="quest-readiness-trail" aria-label={`${readiness.completedMembers} of ${readiness.totalMembers} traveller preferences complete`}>
      <span className="trail-line" aria-hidden="true" />
      {markers.map((_, index) => <span key={index} className={`trail-marker ${index < readiness.completedMembers ? 'is-complete' : ''} ${!unlocked && index === decisionIndex ? 'is-decision' : ''}`}><i aria-hidden="true">{index < readiness.completedMembers ? '✓' : ''}</i><small>{index + 1}</small></span>)}
      <span className={`trail-unlock ${unlocked ? 'is-unlocked' : ''}`}><Icon name={unlocked ? 'check' : 'lock'} size={14} /><small>Quest unlocked</small></span>
    </div>

    {!unlocked && <div className="quest-readiness-decision">
      {readiness.mainTension && <div className="decision-copy"><p className="section-kicker">THE DECISION POINT</p><p>{readiness.mainTension}</p><small>{readiness.explanation}</small></div>}
      <div className="decision-next"><span>Recommended next move</span><strong>{readiness.recommendedAction}</strong></div>
      {readiness.options.length > 0 && <div className="readiness-options" role="group" aria-label="Choose the group trade-off">
        {readiness.options.map((option) => <article key={option.id} className={`readiness-option ${selectedId === option.id ? 'is-selected' : ''}`}>
          <p className="section-kicker">{option.title}</p><h3>{option.summary}</h3><p>{option.detail}</p><button type="button" className={selectedId === option.id ? 'secondary-button' : 'primary-button'} aria-pressed={selectedId === option.id} onClick={() => setSelectedId(option.id)}>{selectedId === option.id ? 'Chosen for now' : `Choose ${option.id === 'comfort' ? 'comfort' : 'experiences'}`} <Icon name={selectedId === option.id ? 'check' : 'arrow'} size={16} /></button></article>)}
      </div>}
      {selected && <p className="readiness-outcome" role="status"><Icon name="spark" size={17} />{selected.outcome}</p>}
      <Link className="readiness-discuss" to={`/quests/${roomId}`}>Discuss another option <Icon name="chat" size={16} /></Link>
    </div>}
  </section>
}
