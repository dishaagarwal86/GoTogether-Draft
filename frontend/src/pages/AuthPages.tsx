import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { countries } from '../data/countries'

export function LoginPage() { return <AuthPage mode="login" /> }
export function SignUpPage() { return <AuthPage mode="signup" /> }

function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const navigate = useNavigate(); const { login, signup } = useAuth()
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const [country, setCountry] = useState(''); const [countryOpen, setCountryOpen] = useState(false)
  const signUp = mode === 'signup'
  const visibleCountries = countries.filter((item) => item.toLowerCase().includes(country.toLowerCase()))
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError('')
    try {
      if (signUp) await signup({ firstName: String(data.get('firstName')), lastName: String(data.get('lastName')), country, email: String(data.get('email')), password: String(data.get('password')) })
      else await login({ email: String(data.get('email')), password: String(data.get('password')) })
      navigate('/plan')
    } catch (err) { setError(err instanceof Error ? err.message : 'Please try again.') } finally { setBusy(false) }
  }
  return <section className="auth-page"><div className="auth-card"><p className="eyebrow">GO.TOGETHER ACCOUNT</p><h1>{signUp ? <>Start your <em>story.</em></> : <>Welcome <em>back.</em></>}</h1><p>{signUp ? 'Create your profile, invite your favourite people, and keep every journey together.' : 'Sign in to return to your quests and Travel DNA.'}</p><form onSubmit={submit}>
    {signUp && <fieldset className="auth-fieldset"><legend>What should we call you?</legend><small>First name or display name, and your last name.</small><div className="auth-row"><input name="firstName" aria-label="First name or display name" placeholder="First or display name" required /><input name="lastName" aria-label="Last name" placeholder="Last name" required /></div></fieldset>}
    <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
    <label>{signUp ? 'Create a password' : 'Password'}{signUp && <small>Use at least 8 characters.</small>}<input name="password" type="password" autoComplete={signUp ? 'new-password' : 'current-password'} minLength={8} required /></label>
    {signUp && <label>Where do you currently live?<div className="auth-country-picker"><input name="country" value={country} onFocus={() => setCountryOpen(true)} onBlur={() => window.setTimeout(() => setCountryOpen(false), 120)} onChange={(event) => { setCountry(event.target.value); setCountryOpen(true) }} placeholder="Search for your country" autoComplete="off" required />{countryOpen && <div className="auth-country-list" role="listbox">{visibleCountries.map((item) => <button type="button" role="option" key={item} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCountry(item); setCountryOpen(false) }}>{item}</button>)}{!visibleCountries.length && <p>No match found</p>}</div>}</div></label>}
    {error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Just a moment…' : signUp ? 'Create my account' : 'Sign in'} <span>→</span></button>
  </form><p className="auth-switch">{signUp ? 'Already have an account?' : 'New to Go.Together?'} <Link to={signUp ? '/login' : '/signup'}>{signUp ? 'Sign in' : 'Create an account'}</Link></p></div></section>
}
