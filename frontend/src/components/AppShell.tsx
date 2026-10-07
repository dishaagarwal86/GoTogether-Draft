import { useEffect } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { CreateRoomPage } from '../pages/CreateRoomPage'
import { PlanTripPage } from '../pages/PlanTripPage'
import { QuestionsPage } from '../pages/QuestionsPage'
import { RoomOverviewPage } from '../pages/RoomOverviewPage'
import { ExplorePage } from '../pages/ExplorePage'
import { GlobalNavbar } from './MainNavigation'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { LoginPage, SignUpPage } from '../pages/AuthPages'
import { ProfilePage } from '../pages/ProfilePage'
import { AuthPrompt } from './AuthPrompt'
import { GroupDnaPage } from '../pages/GroupDnaPage'
import { PlanPathsPage } from '../pages/PlanPathsPage'
import { InvitePage } from '../pages/InvitePage'
import { JoinQuestPage } from '../pages/JoinQuestPage'
import { QuestDetailPage } from '../pages/QuestDetailPage'
import { LandingConcept } from '../pages/LandingConcept'
import { DashboardPage } from '../pages/DashboardPage'
import { EmptyState, Icon, LoadingState } from './Ui'
import { TravelCanvas } from './TravelArtwork'
import { WorkspacePreviewPage } from '../pages/WorkspacePreviewPage'

export function AppShell() { return <AuthProvider><AppLayout /></AuthProvider> }
function RequireAuth() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <LoadingState label="Opening your travel space…" />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <Outlet />
}
function AppLayout() {
  const location = useLocation()
  const isLanding = location.pathname === '/' || location.pathname === '/landing-concept'
  const isAuth = ['/login', '/signup'].includes(location.pathname)
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'instant' })
    const titles: Record<string, string> = { '/dashboard': 'Your next chapter', '/login': 'Welcome back', '/signup': 'Join the journey', '/trips': 'My quests', '/explore': 'Find your somewhere', '/saved': 'Saved places', '/profile': 'Your profile', '/travel-dna/new': 'Start a quest', '/travel-dna/preferences': 'Your travel style', '/travel-dna/group-dna': 'Travel DNA', '/travel-dna/plan-paths': 'Your possible paths' }
    document.title = `${titles[location.pathname] ?? 'Good places. Better company.'} — Go.Together`
  }, [location.pathname, location.hash])
  return <div className={isLanding ? 'app-shell landing-shell gt-preview-shell' : `app-shell journey-shell${isAuth ? ' journey-auth-shell' : ''}`}>
    {!isLanding && !isAuth && <TravelCanvas />}
    {!isLanding && !isAuth && <GlobalNavbar key={location.pathname} />}
    {!isLanding && <a className="journey-skip" href="#main-content">Skip to content</a>}
    <main id="main-content" className={isLanding ? 'landing-main' : isAuth ? 'journey-auth-main' : 'journey-main'}><Routes>
      <Route path="/" element={<HomePage />} /><Route path="/landing-concept" element={<LandingConcept />} />
      <Route path="/login" element={<LoginPage />} /><Route path="/signup" element={<SignUpPage />} />
      <Route path="/invite/:token" element={<InvitePage key={location.pathname} />} /><Route path="/join/:token" element={<JoinQuestPage key={location.pathname} />} /><Route path="/explore" element={<ExplorePage key={location.pathname + location.search} />} />
      <Route path="/inspiration" element={<Navigate to="/explore" replace />} />
      <Route path="/workspace-preview" element={<WorkspacePreviewPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<DashboardPage />} /><Route path="/profile" element={<ProfilePage />} />
        <Route path="/trips" element={<PlanTripPage />} /><Route path="/plan" element={<Navigate to="/trips" replace />} />
        <Route path="/saved" element={<ExplorePage key={location.pathname + location.search} savedOnly />} /><Route path="/quests/:roomId" element={<QuestDetailPage key={location.pathname} />} />
        <Route path="/travel-dna/new" element={<CreateRoomPage key={location.search} />} /><Route path="/travel-dna/preferences" element={<QuestionsPage key={location.search} />} />
        <Route path="/travel-dna/overview" element={<RoomOverviewPage />} /><Route path="/travel-dna/group-dna" element={<GroupDnaPage />} />
        <Route path="/travel-dna/plan-paths" element={<PlanPathsPage />} />
      </Route>
      <Route path="*" element={<EmptyState title="A little off the beaten path." description="This page isn’t here, but your next adventure is." to="/dashboard" label="Back to your overview" />} />
    </Routes></main>
    {!isLanding && !isAuth && <footer className="journey-footer"><span>Good places. Better company.</span><Icon name="spark" size={18} /><Link to="/">The Go.Together story <span>↗</span></Link></footer>}
    <AuthPrompt />
  </div>
}
