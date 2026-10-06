import { Link, useSearchParams } from 'react-router-dom'
import { useQuestRecommendations } from '../hooks/useQuestRecommendations'
import { EmptyState, ErrorState, LoadingState, PageHeading } from '../components/Ui'
import { RecommendationCards } from '../components/RecommendationCards'
export function PlanPathsPage() {
  const [params] = useSearchParams()
  const roomId = params.get('roomId') ?? ''
  const { data, error, retry } = useQuestRecommendations(roomId)
  if (!roomId) return <EmptyState title="A path starts with your people." description="Choose a quest to explore ideas based on the preferences your crew has shared." to="/trips" label="Find your quest" />
  return <section className="flow-page paths-page"><div className="flow-topbar"><Link className="back-link" to={`/travel-dna/group-dna?roomId=${roomId}`}>← Travel DNA</Link><span className="flow-step">A direction to discover together</span></div><PageHeading eyebrow="A FEW DIFFERENT WAYS TO SAY LET’S GO" title={<>One crew.<br />A world of <em>possibility.</em></>} description="Explore these starting points, talk through the trade-offs, and find a direction that feels good together." />{error ? <ErrorState message={error} retry={retry} /> : !data ? <LoadingState label="Finding your possible paths…" /> : data.results.length ? <RecommendationCards results={data.results} roomId={roomId} travelDna={data.travelDna} /> : <EmptyState title="Your next direction is still taking shape." description="Add your travel preferences, or browse the collection for a spark of inspiration." to={`/travel-dna/preferences?roomId=${roomId}`} label="Share my travel style" />}</section>
}
