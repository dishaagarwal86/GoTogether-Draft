import { lazy, Suspense, useEffect } from 'react'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { GlobalNavbar } from './MainNavigation'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { AuthPrompt } from './AuthPrompt'
import { EmptyState, LoadingState } from './Ui'
import { TravelCanvas } from './TravelArtwork'

const HomePage = lazy(() => import('../pages/HomePage').then(module => ({ default: module.HomePage })))
const CreateRoomPage = lazy(() => import('../pages/CreateRoomPage').then(module => ({ default: module.CreateRoomPage })))
const PlanTripPage = lazy(() => import('../pages/PlanTripPage').then(module => ({ default: module.PlanTripPage })))
const RoomOverviewPage = lazy(() => import('../pages/RoomOverviewPage').then(module => ({ default: module.RoomOverviewPage })))
const ExplorePage = lazy(() => import('../pages/ExplorePage').then(module => ({ default: module.ExplorePage })))
const LoginPage = lazy(() => import('../pages/AuthPages').then(module => ({ default: module.LoginPage })))
const SignUpPage = lazy(() => import('../pages/AuthPages').then(module => ({ default: module.SignUpPage })))
const TravelStylePage = lazy(() => import('../pages/TravelStylePage').then(module => ({ default: module.TravelStylePage })))
const ProfilePage = lazy(() => import('../pages/ProfilePage').then(module => ({ default: module.ProfilePage })))
const GroupDnaPage = lazy(() => import('../pages/GroupDnaPage').then(module => ({ default: module.GroupDnaPage })))
const PlanPathsPage = lazy(() => import('../pages/PlanPathsPage').then(module => ({ default: module.PlanPathsPage })))
const InvitePage = lazy(() => import('../pages/InvitePage').then(module => ({ default: module.InvitePage })))
const SharedJoinPage = lazy(() => import('../pages/SharedJoinPage').then(module => ({ default: module.SharedJoinPage })))
const JoinQuestPage = lazy(() => import('../pages/JoinQuestPage').then(module => ({ default: module.JoinQuestPage })))
const QuestDetailPage = lazy(() => import('../pages/QuestDetailPage').then(module => ({ default: module.QuestDetailPage })))
const LandingConcept = lazy(() => import('../pages/LandingConcept').then(module => ({ default: module.LandingConcept })))
const DashboardPage = lazy(() => import('../pages/DashboardPage').then(module => ({ default: module.DashboardPage })))
const WorkspacePreviewPage = lazy(() => import('../pages/WorkspacePreviewPage').then(module => ({ default: module.WorkspacePreviewPage })))
const PhotoCreditsPage = lazy(() => import('../pages/PhotoCreditsPage').then(module => ({ default: module.PhotoCreditsPage })))
const CrewPage = lazy(() => import('../pages/CrewPage').then(module => ({ default: module.CrewPage })))

export function AppShell() { return <AuthProvider><AppLayout /></AuthProvider> }
function RequireAuth() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <LoadingState label="Opening your travel space…" />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <Outlet />
}
function LegacyPreferencesRedirect() {
  const location = useLocation()
  const roomId = new URLSearchParams(location.search).get('roomId')
  return <Navigate to={roomId ? `/quests/${encodeURIComponent(roomId)}?tab=crew&preferences=1` : '/travel-dna/new'} replace />
}
function AppLayout() {
  const location = useLocation()
  const isLanding = location.pathname === '/' || location.pathname === '/landing-concept'
  const isAuth = ['/login', '/signup'].includes(location.pathname)
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'instant' })
    const titles: Record<string, string> = { '/dashboard': 'Your next chapter', '/login': 'Welcome back', '/signup': 'Join the journey', '/trips': 'My quests', '/explore': 'Find your somewhere', '/saved': 'Saved places', '/profile': 'Your profile', '/travel-style': 'Your travel story', '/travel-dna/new': 'Start a quest', '/travel-dna/preferences': 'Your travel style', '/travel-dna/group-dna': 'Travel DNA', '/travel-dna/plan-paths': 'Your possible paths' }
    document.title = `${titles[location.pathname] ?? 'Good places. Better company.'} — Go.Together`
  }, [location.pathname, location.hash])
  return <div className={isLanding ? 'app-shell landing-shell gt-preview-shell' : `app-shell journey-shell${isAuth ? ' journey-auth-shell' : ''}`}>
    {!isLanding && !isAuth && <TravelCanvas />}
    {!isLanding && !isAuth && <GlobalNavbar />}
    {!isLanding && <a className="journey-skip" href="#main-content">Skip to content</a>}
    <main id="main-content" className={isLanding ? 'landing-main' : isAuth ? 'journey-auth-main' : 'journey-main'}><RouteErrorBoundary key={location.pathname}><Suspense fallback={<LoadingState label="Opening your travel space…" />}><Routes>
      <Route path="/" element={<HomePage />} /><Route path="/landing-concept" element={<LandingConcept />} />
      <Route path="/login" element={<LoginPage />} /><Route path="/signup" element={<SignUpPage />} />
      <Route path="/join-room/:token" element={<SharedJoinPage key={location.pathname} />} /><Route path="/invite/:token" element={<InvitePage key={location.pathname} />} /><Route path="/join/:token" element={<JoinQuestPage key={location.pathname} />} /><Route path="/explore" element={<ExplorePage key={location.pathname + location.search} />} />
      <Route path="/inspiration" element={<Navigate to="/explore" replace />} />
      <Route path="/photo-credits" element={<PhotoCreditsPage />} />
      <Route path="/workspace-preview" element={<WorkspacePreviewPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/travel-style" element={<TravelStylePage />} /><Route path="/dashboard" element={<DashboardPage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/crew" element={<CrewPage />} />
        <Route path="/trips" element={<PlanTripPage />} /><Route path="/plan" element={<Navigate to="/trips" replace />} />
        <Route path="/saved" element={<ExplorePage key={location.pathname + location.search} savedOnly />} /><Route path="/quests/:roomId" element={<QuestDetailPage key={location.pathname} />} />
        <Route path="/travel-dna/new" element={<CreateRoomPage key={location.search} />} /><Route path="/travel-dna/preferences" element={<LegacyPreferencesRedirect />} />
        <Route path="/travel-dna/overview" element={<RoomOverviewPage />} /><Route path="/travel-dna/group-dna" element={<GroupDnaPage />} />
        <Route path="/travel-dna/plan-paths" element={<PlanPathsPage />} />
      </Route>
      <Route path="*" element={<EmptyState title="A little off the beaten path." description="This page isn’t here, but your next adventure is." to="/dashboard" label="Back to your overview" />} />
    </Routes></Suspense></RouteErrorBoundary></main>
    {!isLanding && !isAuth && <footer className="journey-footer"><span>Good places. Better company.</span><Link to="/photo-credits">Photo credits</Link><Link to="/">The Go.Together story <span>↗</span></Link></footer>}
    <AuthPrompt />
  </div>
}
