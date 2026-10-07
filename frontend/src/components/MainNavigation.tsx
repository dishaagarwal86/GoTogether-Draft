import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Brand, Icon } from './Ui'
import { QuestInvitations } from './QuestInvitations'

export function GlobalNavbar() {
  const { user, logout } = useAuth()
  const [menu, setMenu] = useState(false)
  const [profile, setProfile] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuLocation, setMenuLocation] = useState(pathname)
  if (menuLocation !== pathname) { setMenuLocation(pathname); setMenu(false); setProfile(false) }
  const profileRef = useRef<HTMLDivElement>(null)
  useEffect(() => { const close = (event: PointerEvent) => { if (!profileRef.current?.contains(event.target as Node)) setProfile(false) }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close) }, [])
  return <header className="journey-nav" onKeyDown={(event) => { if (event.key === 'Escape') { setMenu(false); setProfile(false) } }}><div className="journey-nav-inner">
    <Link to={user ? '/dashboard' : '/'} aria-label="GoTogether home"><Brand /></Link>
    <nav className={`journey-nav-links${menu ? ' is-open' : ''}`} id="journey-navigation" aria-label="Main navigation">
      {user && <NavLink to="/dashboard">Overview</NavLink>}<NavLink to="/trips">My quests</NavLink><NavLink to="/explore">Explore</NavLink><NavLink to="/saved">Saved places</NavLink>
    </nav>
    <div className="journey-nav-actions">{user ? <><Link className="nav-create" to="/travel-dna/new"><Icon name="plus" size={16} /> New quest</Link><QuestInvitations key={user.id} /><div className="journey-user" ref={profileRef}><button className="journey-avatar" type="button" aria-label="Open account menu" aria-expanded={profile} aria-controls="account-menu" onClick={() => setProfile(!profile)}>{user.firstName[0]}{user.lastName[0]}</button>{profile && <div className="journey-user-menu" id="account-menu"><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small><Link to="/crew">My crew <Icon name="people" size={16} /></Link><Link to="/travel-style">My travel style <Icon name="leaf" size={16} /></Link><Link to="/profile">My profile <Icon name="people" size={16} /></Link><Link to="/trips">My quests <Icon name="compass" size={16} /></Link><button type="button" onClick={async () => { try { await logout() } catch { /* Local session is cleared even if the API is unreachable. */ } navigate('/login') }}>Sign out <Icon size={16} /></button></div>}</div></> : <><Link to="/login">Sign in</Link><Link className="nav-create" to="/signup">Join the journey <Icon size={16} /></Link></>}
    <button className="journey-menu-toggle" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} aria-controls="journey-navigation" onClick={() => setMenu(!menu)}><Icon name={menu ? 'close' : 'menu'} /></button></div>
  </div></header>
}
