import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/Ui'
export function RoomOverviewPage() {
  const location = useLocation()
  const [params] = useSearchParams()
  const roomId = params.get('roomId') ?? location.state?.roomId
  if (roomId) return <Navigate to={`/quests/${encodeURIComponent(String(roomId))}`} replace />
  return <EmptyState title="Your plans have a home." description="Pick up a saved quest to see its preferences, travel ideas, and crew conversation." to="/trips" label="Open your quests" />
}
