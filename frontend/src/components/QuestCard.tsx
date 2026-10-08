import { destinationPhotos } from '../data/destinationPhotos'
import { knownPhotoDestination } from '../services/photoCatalogue'
import { useDestinationPhoto } from '../services/placePhotos'
import { Link } from 'react-router-dom'
import type { Quest } from '../apis/quests'
import { Icon } from './Ui'
import { useAuth } from '../auth/AuthContext'
export function QuestCard({ quest }: { quest: Quest; index?: number }) {
  const { user } = useAuth()
  const name = `${quest.name} ${quest.tripName}`.toLowerCase()
  const place = knownPhotoDestination(quest.tripName) || Object.keys(destinationPhotos).find(id => new RegExp(`\\b${id}\\b`).test(name)) || ''
  const { src: image, srcSet, ref, onError } = useDestinationPhoto(place)
  return <Link className="journey-quest-card" to={`/quests/${quest.id}`}><div className="journey-quest-photo"><img src={image} srcSet={srcSet} sizes="(max-width:700px) 90vw, 400px" ref={ref} onError={onError} alt="" loading="lazy" /><span>{quest.role === 'owner' ? 'Hosting' : 'With your crew'}</span><span className="quest-photo-arrow"><Icon name="northeast" /></span></div><div className="journey-quest-copy"><p className="eyebrow">A PLAN IN THE MAKING</p><h2>{quest.name}</h2><p><Icon name="pin" size={15} />{quest.tripName === quest.name ? 'The destination is part of the adventure' : quest.tripName}</p><div className="journey-quest-meta"><span><span className="small-avatar">{user?.firstName[0]}</span>{quest.members} planned {quest.members === 1 ? 'traveller' : 'travellers'}</span><span>Open quest <Icon size={15} /></span></div></div></Link>
}
