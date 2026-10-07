import { Navigate, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/Ui'
export function PlanPathsPage() {
  const [params] = useSearchParams()
  const roomId = params.get('roomId')
  return roomId ? <Navigate to={`/quests/${encodeURIComponent(roomId)}?tab=options`} replace /> : <EmptyState title="A path starts with your people." description="Choose a quest to compare your group's itineraries." to="/trips" label="Find your quest" />
}
