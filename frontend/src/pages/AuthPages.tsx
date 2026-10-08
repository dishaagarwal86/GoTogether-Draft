import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { countries } from '../data/countries'
import { Brand, Icon, LoadingState } from '../components/Ui'
import { TravelCanvas } from '../components/TravelArtwork'
import { safeNext } from '../services/journeyStorage'
import coast from '../assets/coast-hero.webp'
import mountains from '../assets/landing/mountains.jpg'

export function LoginPage() { return <AuthPage mode="login" key="login" /> }
export function SignUpPage() { return <AuthPage mode="signup" key="signup" /> }
function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { login, signup, user, ready } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const signUp = mode === 'signup'
  const isGuestClaim = Boolean(new URLSearchParams(location.search).get('next')?.includes('/join/'))
  const next = safeNext(location.search)
  const switchTo = `${signUp ? '/login' : '/signup'}${location.search}`
  if (!ready) return <LoadingState />
  if (user) return <Navigate to={next} replace />
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    setBusy(true); setError('')
    try {
      const credentials = { email: String(data.get('email')).trim(), password: String(data.get('password')) }
      if (signUp && isGuestClaim && data.get('consent') !== 'yes') throw new Error('Please confirm that you would like to create your GoTogether profile.')
      if (signUp) await signup({ ...credentials, firstName: String(data.get('firstName')).trim(), lastName: String(data.get('lastName')).trim(), country: String(data.get('country')) })
      else await login(credentials)
      navigate(next, { replace: true, state: { welcome: signUp } })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We couldn’t connect. Please try again.') }
    finally { setBusy(false) }
  }
  return <section className="account-layout">
    <aside className="account-landscape"><img src={signUp ? mountains : coast} alt={signUp ? 'A sunlit mountain valley and a path into the distance' : 'A quiet Mediterranean cove beside an Italian village'} /><div className="account-landscape-shade" /><Link className="account-brand" to="/" aria-label="GoTogether home"><Brand /></Link><div className="account-landscape-copy"><span className="account-overline"><i /> GOOD PLACES. BETTER COMPANY.</span><h2>{signUp ? <>The first step{' '}<br />to your next{' '}<br /><em>remember when.</em></> : <>Somewhere good.{' '}<br />Someone<br /><em>beside you.</em></>}</h2><p>A little less planning in the group chat.<br />A little more being there, together.</p><div className="account-caption"><Icon name="pin" size={16} />{signUp ? 'The alpine chapter · A fresh perspective' : 'The coastal chapter · Take the slow road'}</div></div><span className="account-photo-note">Meet you somewhere good.</span></aside>
    <div className="account-form-side"><TravelCanvas variant="auth" /><div className="account-top"><Link to="/" className="account-back">← Back to the good stuff</Link><span>{signUp ? 'Already one of us?' : 'New around here?'} <Link to={switchTo}>{signUp ? 'Sign in' : 'Join us'} ↗</Link></span></div>
      <div className="account-form-wrap"><span className="account-symbol"><Icon name={signUp ? 'spark' : 'sun'} size={30} /></span><p className="eyebrow">{signUp ? 'YOUR NEXT CHAPTER STARTS HERE' : 'YOUR PEOPLE. YOUR PLANS. YOUR PLACE.'}</p><h1>{signUp ? <>Good things start<br /><em>with together.</em></> : <>Hello again,<br /><em>explorer.</em></>}</h1><p className="account-intro">{signUp ? 'Make a little space for your next big memory.' : 'Your next adventure is right where you left it.'}</p>
        {import.meta.env.VITE_LOCAL_PREVIEW === 'true' && <p className="account-local-note" role="note">Local preview · Use an account created here. Your deployed GoTogether account is separate.</p>}
        <form onSubmit={submit} className="account-form" aria-busy={busy}>
          {signUp && <div className="field-row"><label>First name<input name="firstName" autoComplete="given-name" placeholder="First name" required maxLength={60} /></label><label>Last name<input name="lastName" autoComplete="family-name" placeholder="Last name" required maxLength={60} /></label></div>}
          <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" defaultValue={new URLSearchParams(location.search).get('email') ?? ''} required /></label>
          <label htmlFor="account-password">{signUp ? 'Create a password' : 'Password'}</label><div className="password-field"><input id="account-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={signUp ? 'new-password' : 'current-password'} placeholder={signUp ? 'At least 8 characters' : 'Your password'} minLength={signUp ? 8 : undefined} required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name="eye" size={19} /></button></div>
          {signUp && <label>Where’s home? <span className="field-optional">Optional</span><select name="country" autoComplete="country-name" defaultValue=""><option value="">Choose your country</option>{countries.map((country) => <option key={country}>{country}</option>)}</select></label>}
          {signUp && isGuestClaim && <label className="journey-checkbox"><input name="consent" type="checkbox" value="yes" required /> I agree to create a GoTogether profile and save my place in this quest.</label>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'A little moment…' : signUp ? 'Create my account' : 'Let’s get back out there'}<Icon /></button>
        </form>
        <p className="account-switch">{signUp ? 'Already have a Go.Together account?' : 'Your first time here?'} <Link to={switchTo}>{signUp ? 'Sign in' : 'Create an account'} <span>↗</span></Link></p>
        <p className="account-reassurance"><Icon name="lock" size={14} />Your plans have a home. Your password stays private.</p>
      </div><div className="account-bottom"><span>Less “someday”. More together.</span><Icon name="spark" size={18} /><span>Go.Together</span></div>
    </div>
  </section>
}
