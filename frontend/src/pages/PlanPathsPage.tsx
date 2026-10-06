import { Link, useSearchParams } from 'react-router-dom'
import { useQuestRecommendations } from '../hooks/useQuestRecommendations'
import { EmptyState, ErrorState, LoadingState, PageHeading } from '../components/Ui'
import { RecommendationCards } from '../components/RecommendationCards'
export function PlanPathsPage() {
  const [params] = useSearchParams()
  const roomId = params.get('roomId') ?? ''
  const { data, error, retry } = useQuestRecommendations(roomId)
  if (!roomId) return <EmptyState title="A path starts with your people." description="Choose a quest to explore ideas based on the preferences your crew has shared." to="/trips" label="Find your quest" />
  return <section className="flow-page paths-page"><div className="flow-topbar"><Link className="back-link" to={`/travel-dna/group-dna?roomId=${roomId}`}>← Travel DNA</Link><span className="flow-step">A direction to discover together</span></div><PageHeading eyebrow="CURATED JOURNEYS FOR YOUR SHARED PLAN" title={<>Plans that leave room<br />for <em>everyone.</em></>} description="These journeys balance what your group loves, not just what is easiest to choose." />{error ? <ErrorState message={error} retry={retry} /> : !data ? <LoadingState label="Finding a plan with room for every voice…" /> : data.results.length ? <RecommendationCards results={data.results} roomId={roomId} travelDna={data.travelDna} /> : <EmptyState title="The best trips need a few more voices." description="Invite your people to help shape this quest." to={`/travel-dna/preferences?roomId=${roomId}`} label="Share my travel style" />}</section>
}
