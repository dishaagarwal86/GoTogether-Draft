import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { acceptInvite, getInvite, type InviteDetails } from '../apis/invites'
import { useAuth } from '../auth/AuthContext'
import { Icon, LoadingState } from '../components/Ui'
export function InvitePage() {
  const { token = '' } = useParams()
  const { user, ready, logout } = useAuth()
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [error, setError] = useState('')
  const [acceptError, setAcceptError] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { let active = true; getInvite(token).then((result) => { if (active) setInvite(result) }).catch((reason: Error) => { if (active) setError(reason.message) }); return () => { active = false } }, [token])
  const next = `?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(invite?.email ?? '')}`
  const join = async () => { if (busy) return; setBusy(true); setAcceptError(''); try { await acceptInvite(token); setAccepted(true) } catch (reason) { setAcceptError(reason instanceof Error ? reason.message : 'We couldn’t accept your invitation. Please try again.') } finally { setBusy(false) } }
  if (!ready || (!invite && !error)) return <LoadingState label="Making space for one more voice…" />
  return <section className="auth-page"><div className="auth-card"><span className="account-symbol"><Icon name={accepted ? 'check' : 'people'} size={28} /></span><p className="eyebrow">{error ? 'A LITTLE DETOUR' : accepted ? 'YOUR VOICE IS IN' : 'A SHARED PLAN STARTS HERE'}</p><h1>{error ? <>This invitation has <em>moved on.</em></> : accepted ? <>You’re part of <em>{invite!.room.name}.</em></> : <>Bring your people<br />into the <em>plan.</em></>}</h1>
    {error ? <><p>{error}</p><p>Ask your friend for a fresh invitation and you’ll be back on your way.</p><Link className="primary-button" to="/trips">Back to my quests <Icon /></Link></> : accepted ? <><p>Tell the group what a good trip looks like to you. Your voice now has a place in the plan.</p><Link className="primary-button" to={`/travel-dna/preferences?roomId=${invite!.room.id}`}>Share my travel style <Icon /></Link><p><Link to={`/quests/${invite!.room.id}`}>Take me to the quest →</Link></p></> : <><p>Everyone adds their own travel style. Join with <strong>{invite!.email}</strong> and help shape a fair shared plan—without anyone compromising silently.</p>{!user ? <div className="invite-actions"><Link className="primary-button" to={`/signup${next}`}>Create an account and join <Icon /></Link><Link className="auth-prompt-login" to={`/login${next}`}>Already one of us? Sign in ↗</Link></div> : user.email.toLowerCase() !== invite!.email.toLowerCase() ? <><p className="form-error">You’re signed in as {user.email}. This invitation is for {invite!.email}.</p><button type="button" className="primary-button" onClick={async () => { try { await logout() } catch { /* Local session has been cleared. */ } }}>Switch account <Icon /></button></> : <><button className="primary-button" type="button" disabled={busy} onClick={join}>{busy ? 'Making room for you…' : 'Join this quest'}<Icon /></button>{acceptError && <p className="form-error" role="alert">{acceptError}</p>}</>}</>}
  </div></section>
}
