import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { CreateRoomPage } from '../pages/CreateRoomPage'
import { InspirationPage, TripsPage } from '../pages/Pages'
import { PlanTripPage } from '../pages/PlanTripPage'
import { QuestionsPage } from '../pages/QuestionsPage'
import { RoomOverviewPage } from '../pages/RoomOverviewPage'
import { ExplorePage } from '../pages/ExplorePage'
import { GlobalNavbar } from './MainNavigation'
import { AuthProvider } from '../auth/AuthContext'
import { LoginPage, SignUpPage } from '../pages/AuthPages'
import { ProfilePage } from '../pages/ProfilePage'
import { AuthPrompt } from './AuthPrompt'
import { GroupDnaPage } from '../pages/GroupDnaPage'
import { PlanPathsPage } from '../pages/PlanPathsPage'
import { InvitePage } from '../pages/InvitePage'
import { QuestDetailPage } from '../pages/QuestDetailPage'
import { LandingConcept } from '../pages/LandingConcept'

export function AppShell() { return <AuthProvider><AppLayout /></AuthProvider> }
function AppLayout() {
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const isLanding = location.pathname === '/' || location.pathname === '/landing-concept'
  const isExplore = location.pathname === '/explore'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return <div className={`${scrolled ? 'app-shell is-scrolled' : 'app-shell'}${isLanding ? ' landing-shell gt-preview-shell' : ''}`}>
    {!isLanding && <GlobalNavbar isLanding={isLanding} isScrolled={scrolled} />}
    <main className={`${isLanding ? 'landing-main' : ''}${isExplore ? ' explore-route-main' : ''}`}><RouteView /></main><AuthPrompt />
  </div>
}

function RouteView() {
  return <div className="route-view"><Routes><Route path="/landing-concept" element={<LandingConcept />} /><Route path="/" element={<HomePage />} /><Route path="/login" element={<LoginPage />} /><Route path="/signup" element={<SignUpPage />} /><Route path="/invite/:token" element={<InvitePage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/trips" element={<TripsPage />} /><Route path="/inspiration" element={<InspirationPage />} /><Route path="/explore" element={<ExplorePage />} /><Route path="/plan" element={<PlanTripPage />} /><Route path="/quests/:roomId" element={<QuestDetailPage />} /><Route path="/travel-dna/new" element={<CreateRoomPage />} /><Route path="/travel-dna/preferences" element={<QuestionsPage />} /><Route path="/travel-dna/overview" element={<RoomOverviewPage />} /><Route path="/travel-dna/group-dna" element={<GroupDnaPage />} /><Route path="/travel-dna/plan-paths" element={<PlanPathsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></div>
}
