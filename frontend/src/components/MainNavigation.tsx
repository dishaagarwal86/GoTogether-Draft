import { Link, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

type MainNavigationProps = {
  isLanding: boolean
  isScrolled: boolean
}

/** The app's single persistent navigation bar. */
export function GlobalNavbar({ isLanding, isScrolled }: MainNavigationProps) {
  const { user, logout, requestSignIn } = useAuth(); const [open, setOpen] = useState(false)
  const className = `global-nav${isLanding ? ' landing-global-nav' : ''}${isScrolled ? ' is-scrolled' : ''}`

  return <header className={className}>
    <div className="navigation-content">
      <Link className="ocean-brand" to="/" aria-label="GoTogether home">Go.Together</Link>
      <nav className="ocean-links" aria-label="Main navigation">
        <Link to="/#popular">Discover</Link>
        <NavLink to="/trips" onClick={(event) => { if (!user) { event.preventDefault(); requestSignIn() } }}>Quests</NavLink>
        <NavLink to="/inspiration">About us</NavLink>
        <NavLink className="explore-link" to="/explore">Explore <span>↗</span></NavLink>
        {user ? <div className="user-nav"><button type="button" className="user-trigger" onClick={() => setOpen(!open)} aria-expanded={open}>{`${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}` || 'U'}</button>{open && <div className="user-menu"><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small><NavLink to="/profile" onClick={() => setOpen(false)}>My profile</NavLink><NavLink to="/plan" onClick={() => setOpen(false)}>My quests</NavLink><button type="button" onClick={() => { void logout(); setOpen(false) }}>Sign out</button></div>}</div> : <div className="auth-nav"><NavLink to="/login">Sign in</NavLink><NavLink to="/signup" className="join-link">Join us</NavLink></div>}
      </nav>
    </div>
  </header>
}
