import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { acceptInvite, claimGuestInvitePreferences, getInvite, saveGuestInvitePreferences, type InviteDetails } from '../apis/invites'
import { useAuth } from '../auth/AuthContext'
import { Icon, LoadingState } from '../components/Ui'

const sessionKey = (token: string) => `gotogether.guest-invite.${token}`
const newSession = () => crypto.randomUUID()

export function JoinQuestPage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, ready } = useAuth()
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [screen, setScreen] = useState<'landing' | 'form' | 'complete'>('landing')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const guestSessionId = useMemo(() => { const stored = localStorage.getItem(sessionKey(token)); if (stored) return stored; const next = newSession(); localStorage.setItem(sessionKey(token), next); return next }, [token])
  useEffect(() => { let active = true; getInvite(token).then((value) => { if (active) setInvite(value) }).catch((reason: Error) => { if (active) setError(reason.message) }); return () => { active = false } }, [token])
  useEffect(() => {
    if (!user || !params.get('claim')) return
    let active = true; setBusy(true)
    claimGuestInvitePreferences(token, params.get('claim')!).then((room) => { if (active) { localStorage.removeItem(sessionKey(token)); navigate(`/travel-dna/group-dna?roomId=${room.id}`, { replace: true }) } }).catch((reason: Error) => { if (active) setError(reason.message) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [user, token, params, navigate])
  const joinAsMember = async () => { if (!user) return; setBusy(true); try { const room = await acceptInvite(token); navigate(`/travel-dna/preferences?roomId=${room.id}`, { replace: true }) } catch (reason) { setError(reason instanceof Error ? reason.message : 'This invitation could not be accepted.') } finally { setBusy(false) } }
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (busy) return; const data = new FormData(event.currentTarget); setBusy(true); setError(''); try { await saveGuestInvitePreferences(token, guestSessionId, { budget: data.get('budget'), moodPreferences: [data.get('mood')].filter(Boolean), accommodationPreferences: [data.get('stay')].filter(Boolean), activitiesMustHave: data.get('mustHave'), activitiesPreferred: data.get('niceToHave'), noGo: data.get('noGo'), pace: data.get('pace'), peopleCount: invite?.memberCount ?? 1 }); setScreen('complete') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your preferences could not be saved. Please try again.') } finally { setBusy(false) } }
  if (!ready || (!invite && !error)) return <LoadingState label="Opening your invitation…" />
  if (error && !invite) return <section className="auth-page"><div className="auth-card"><p className="eyebrow">A LITTLE DETOUR</p><h1>This invitation is <em>unavailable.</em></h1><p>{error}</p><Link className="primary-button" to="/">Back home <Icon /></Link></div></section>
  const profileNext = encodeURIComponent(`/join/${token}?claim=${guestSessionId}`)
  return <section className="auth-page"><div className="auth-card join-quest-card"><span className="account-symbol"><Icon name="people" size={28} /></span>{screen === 'landing' && <><p className="eyebrow">A SHARED PLAN STARTS HERE</p><h1>You’ve been invited to <em>{invite!.room.name}.</em></h1><p>Organised by {invite!.organiserName}. {invite!.completedPreferences ?? 0} of {invite!.memberCount ?? 1} travellers have added their preferences.</p><p>Every good quest needs your point of view.</p>{user ? <button type="button" className="primary-button" disabled={busy} onClick={joinAsMember}>{busy ? 'Joining…' : 'Add my travel style'} <Icon /></button> : <button type="button" className="primary-button" onClick={() => setScreen('form')}>Add my travel style <Icon /></button>}</>}{screen === 'form' && <><p className="eyebrow">YOUR VOICE IN THE PLAN</p><h1>What matters most to <em>you?</em></h1><p>You can share your travel style now. Creating an account can wait until you are done.</p><form className="account-form" onSubmit={submit}><label>Budget style<select name="budget" required defaultValue=""><option value="" disabled>Choose a budget</option><option>Budget-friendly</option><option>Moderate</option><option>Premium</option></select></label><label>Trip mood<select name="mood" required defaultValue=""><option value="" disabled>Choose a mood</option><option>Food & local culture</option><option>Nature</option><option>Relaxation</option><option>Adventure</option></select></label><label>Stay style<select name="stay" defaultValue=""><option value="">I’m open to options</option><option>Hotel</option><option>Apartment / home rental</option><option>Resort</option></select></label><label>One thing you would love<textarea name="mustHave" rows={2} placeholder="A food market, a cooking class, a long beach walk…" /></label><label>Anything you would rather avoid?<textarea name="noGo" rows={2} placeholder="Early starts, crowded places, long drives…" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving your voice…' : 'Add my travel style'} <Icon /></button></form></>}{screen === 'complete' && <><p className="eyebrow">YOUR VOICE IS IN</p><h1>You’ve added your voice to the <em>quest.</em></h1><p>Save your place so your preferences stay with you and your group can keep planning together.</p><Link className="primary-button" to={`/signup?email=${encodeURIComponent(invite!.email)}&next=${profileNext}`}>Create my GoTogether profile <Icon /></Link><Link className="auth-prompt-login" to="/">Finish later</Link></>}</div></section>
}
