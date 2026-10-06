import { Link, useSearchParams } from 'react-router-dom'
import { CompanionPanel } from '../components/CompanionPanel'
import { useQuestRecommendations } from '../hooks/useQuestRecommendations'
import { EmptyState, ErrorState, Icon, LoadingState } from '../components/Ui'
import { TravelArtwork } from '../components/TravelArtwork'
export function GroupDnaPage() {
  const [params] = useSearchParams()
  const roomId = params.get('roomId') ?? ''
  const { data, error, retry } = useQuestRecommendations(roomId)
  if (!roomId) return <EmptyState title="Every crew has its own rhythm." description="Open a quest to see the travel style you’re building together." to="/trips" label="Find your quest" />
  if (error) return <ErrorState message={error} retry={retry} />
  if (!data) return <LoadingState label="Finding your common ground…" />
  if (!data.travelDna) return <EmptyState title="Let’s start with your kind of good day." description="Share your preferences first. Your Travel DNA will grow as your crew adds theirs." to={`/travel-dna/preferences?roomId=${roomId}`} label="Share my travel style" />
  const dna = data.travelDna
  return <section className="flow-page dna-page"><div className="flow-topbar"><Link className="back-link" to={`/quests/${roomId}`}>← Your quest</Link><span className="flow-step">{data.memberCount ?? 1} {(data.memberCount ?? 1) === 1 ? 'traveller has' : 'travellers have'} shared preferences</span></div><header className="dna-detail-hero"><div><p className="eyebrow">DIFFERENT BY NATURE. BETTER TOGETHER.</p><h1>Your people.<br />Your rhythm.<br /><em>Your Travel DNA.</em></h1><p>A picture of the preferences shared so far. As more people add their voice, your common ground takes shape.</p></div><div className="dna-keepsakes" aria-hidden="true"><TravelArtwork motif="luggage" /><TravelArtwork motif="stamp" /></div></header><div className="dna-insights"><article><p className="section-kicker">The things that light you up</p><h2>{dna.sharedVibe.join(' + ') || 'Open to discovery'}</h2><p>The interests your crew has shared so far. Make room for a little of each.</p></article><article><p className="section-kicker">A comfortable starting point</p><h2>{dna.budgetStyle}</h2><p>Start with the most budget-conscious preference, then agree on the details together.</p></article><article><p className="section-kicker">Room for every voice</p><h2>{data.memberCount === 1 ? 'Your voice is in.' : `${data.memberCount ?? 1} perspectives. One journey.`}</h2><p>{data.memberCount === 1 ? 'Invite your people and ask them to add their preferences. This picture will grow with your crew.' : 'Your shared plan starts here. Talk through everyone’s essentials before choosing a direction.'}</p></article></div><div className="dna-actions"><Link className="primary-button" to={`/travel-dna/plan-paths?roomId=${roomId}`}>See our possible paths <Icon /></Link><Link className="text-button" to={`/travel-dna/preferences?roomId=${roomId}`}>Update my preferences <Icon size={16} /></Link></div><CompanionPanel context={{ travelDna: dna, travellers: data.memberCount }} /></section>
}
