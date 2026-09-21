import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { CreateRoomPage } from '../pages/CreateRoomPage'
import { InspirationPage, TripsPage } from '../pages/Pages'
import { PlanTripPage } from '../pages/PlanTripPage'
import { QuestionsPage } from '../pages/QuestionsPage'
import { RoomOverviewPage } from '../pages/RoomOverviewPage'

export function AppShell() {
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const isLanding = location.pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return <div className={`${scrolled ? 'app-shell is-scrolled' : 'app-shell'}${isLanding ? ' landing-shell' : ''}`}>
    {!isLanding && <header className={scrolled ? 'topbar is-scrolled' : 'topbar'}>
      <Link className="brand" to="/" aria-label="GoTogether home"><span className="brand-mark">go<span>•</span></span>together</Link>
      <nav className="main-nav" aria-label="Main navigation"><NavLink to="/" end className="nav-link">Home</NavLink><NavLink to="/trips" className="nav-link">My trips</NavLink><NavLink to="/inspiration" className="nav-link">Inspiration</NavLink></nav>
      <div className="profile-actions"><button className="icon-button" type="button" aria-label="Notifications">♧<i /></button><button className="profile-button" type="button"><span className="avatar">AM</span><span className="profile-name">Alex Morgan</span><span>⌄</span></button></div>
    </header>}
    <main className={isLanding ? 'landing-main' : ''}><RouteView /></main>
  </div>
}

function RouteView() {
  const location = useLocation()
  return <div className="route-view" key={location.pathname}><Routes><Route path="/" element={<HomePage />} /><Route path="/trips" element={<TripsPage />} /><Route path="/inspiration" element={<InspirationPage />} /><Route path="/plan" element={<PlanTripPage />} /><Route path="/room/new" element={<CreateRoomPage />} /><Route path="/room/questions" element={<QuestionsPage />} /><Route path="/room/overview" element={<RoomOverviewPage />} /><Route path="*" element={<HomePage />} /></Routes></div>
}
