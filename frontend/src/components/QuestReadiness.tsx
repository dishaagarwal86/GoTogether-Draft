import { Link } from 'react-router-dom'
import type { QuestReadiness as QuestReadinessData } from '../apis/quests'
import { Icon } from './Ui'

export function QuestReadiness({ readiness, roomId }: { readiness: QuestReadinessData; roomId: string }) {
  return <section className="quest-readiness"><p className="eyebrow">YOUR GROUP’S PROGRESS</p><h2>{readiness.completedMembers} of {readiness.totalMembers} preferences ready.</h2><p>{readiness.recommendedAction}</p><p>{readiness.mainTension || readiness.explanation}</p><Link className="primary-button" to={`/quests/${roomId}?tab=${readiness.readinessState === 'unlocked' ? 'options' : 'crew'}`}>Continue in your room <Icon /></Link></section>
}
