import { useEffect, useState } from 'react'
import type { QuestDna, QuestRecommendation } from '../apis/quests'
import { castVote, getVotes, type QuestVotes } from '../services/workingPlanApi'
import { RecommendationCards } from './RecommendationCards'
import { Icon } from './Ui'

type Props = { results: QuestRecommendation[]; roomId: string; travelDna?: QuestDna | null; isOwner: boolean; busy: boolean; confirmLabel: (trip: QuestRecommendation) => string; onConfirm: (trip: QuestRecommendation) => void; currentId?: string }

export function VoteBoard({ results, roomId, travelDna, isOwner, busy, confirmLabel, onConfirm, currentId }: Props) {
  const [state, setState] = useState<QuestVotes | null>(null)
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const load = () => getVotes(roomId).then(value => { if (active) setState(value) }).catch(() => { /* the board still works without the tally */ })
    load()
    const timer = window.setInterval(load, 20000)
    return () => { active = false; window.clearInterval(timer) }
  }, [roomId])
  const current = (state?.votes ?? []).filter(vote => results.some(trip => trip.id === vote.itineraryId))
  const votesFor = (trip: QuestRecommendation) => current.filter(vote => vote.itineraryId === trip.id)
  const myVote = current.find(vote => vote.isMe)?.itineraryId
  const top = Math.max(0, ...results.map(trip => votesFor(trip).length))
  const leaders = results.filter(trip => top > 0 && votesFor(trip).length === top)
  const vote = async (trip: QuestRecommendation) => {
    setVoting(true); setError('')
    try { setState(await castVote(roomId, trip.id)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your vote could not be saved.') } finally { setVoting(false) }
  }
  const members = state?.members.length ?? 0
  return <div className="vote-board">
    <div className="vote-summary">
      <div><p className="canvas-kicker">VOTE TOGETHER</p><strong>{current.length} of {members || '…'} {members === 1 ? 'traveller has' : 'travellers have'} voted</strong><p>{leaders.length === 1 ? <>Leading: <b>{leaders[0].destination}</b>. </> : leaders.length > 1 ? <>Tied: {leaders.map(trip => trip.destination).join(' and ')}. </> : null}{isOwner ? 'Explore each option, vote, then confirm the trip your crew wants.' : 'Explore each option and vote. Your host confirms the final trip.'}</p></div>
      <ul>{results.map(trip => <li key={trip.id}><span>{trip.destination}</span><i style={{ width: `${members ? (votesFor(trip).length / members) * 100 : 0}%` }} /><small>{votesFor(trip).length} {votesFor(trip).length === 1 ? 'vote' : 'votes'}{votesFor(trip).length ? ` · ${votesFor(trip).map(item => item.isMe ? 'You' : item.name).join(', ')}` : ''}</small></li>)}</ul>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <RecommendationCards results={results} roomId={roomId} travelDna={travelDna} workspace
      renderBadge={trip => <span className={`vote-badge ${myVote === trip.id ? 'is-mine' : ''}`}>{votesFor(trip).length} {votesFor(trip).length === 1 ? 'vote' : 'votes'}{myVote === trip.id ? ' · your pick' : ''}</span>}
      renderAction={trip => <div className="vote-actions">
        <button className="secondary-button" type="button" disabled={voting || myVote === trip.id} onClick={() => void vote(trip)}>{myVote === trip.id ? <><Icon name="check" size={15} />Your vote</> : `Vote for ${trip.destination}`}</button>
        {isOwner && (trip.id === currentId ? <span className="vote-current"><Icon name="check" size={15} />Current plan</span> : <button className="primary-button" type="button" disabled={busy} onClick={() => onConfirm(trip)}>{confirmLabel(trip)} <Icon /></button>)}
      </div>} />
  </div>
}
