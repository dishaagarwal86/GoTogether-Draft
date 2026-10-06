import { destinationPhotos } from '../data/destinationPhotos'
import { Link } from 'react-router-dom'
import type { Quest } from '../apis/quests'
import { Icon } from './Ui'
import { useAuth } from '../auth/AuthContext'
export function QuestCard({ quest, index = 0 }: { quest: Quest; index?: number }) {
  const { user } = useAuth()
  const name = `${quest.name} ${quest.tripName}`.toLowerCase()
  const image = Object.entries(destinationPhotos).find(([id]) => name.includes(id))?.[1] ?? Object.values(destinationPhotos)[index % 5]
  return <Link className="journey-quest-card" to={`/quests/${quest.id}`}><div className="journey-quest-photo"><img src={image} alt="" loading="lazy" /><span>{quest.role === 'owner' ? 'Hosting' : 'With your crew'}</span><span className="quest-photo-arrow"><Icon name="northeast" /></span></div><div className="journey-quest-copy"><p className="eyebrow">A PLAN IN THE MAKING</p><h2>{quest.name}</h2><p><Icon name="pin" size={15} />{quest.tripName === quest.name ? 'The destination is part of the adventure' : quest.tripName}</p><div className="journey-quest-meta"><span><span className="small-avatar">{user?.firstName[0]}</span>{quest.members} planned {quest.members === 1 ? 'traveller' : 'travellers'}</span><span>Open quest <Icon size={15} /></span></div></div></Link>
}
