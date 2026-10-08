import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { joinSharedRoom, sharedInvitation } from '../apis/quests'
import { Icon, LoadingState } from '../components/Ui'

export function SharedJoinPage() {
  const { token = '' } = useParams()
  const { user, ready } = useAuth()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<Awaited<ReturnType<typeof sharedInvitation>> | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { let active = true; sharedInvitation(token).then(value => { if (active) setInvite(value) }).catch(reason => { if (active) setError(reason.message) }); return () => { active = false } }, [token])
  const join = async () => { if (busy) return; setBusy(true); try { const room = await joinSharedRoom(token); navigate(`/quests/${room.roomId}?tab=crew&preferences=1`, { replace: true }) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your place could not be saved.') } finally { setBusy(false) } }
  if (!ready || !invite && !error) return <LoadingState label="Opening a place in the crew…" />
  const next = encodeURIComponent(`/join-room/${token}`)
  return <section className="auth-page"><div className="auth-card join-quest-card"><span className="account-symbol"><Icon name="people" size={28} /></span><p className="eyebrow">SOMEWHERE GOOD. YOUR PEOPLE.</p><h1>{invite ? <>Join <em>{invite.name}.</em></> : <>A little <em>detour.</em></>}</h1>{invite && <><p>{invite.host} is bringing the crew together. {invite.completedMembers} of {invite.totalMembers} travellers have confirmed their preferences.</p><p>Join the room, add your travel style, and help choose the itinerary together.</p>{user ? <button className="primary-button" disabled={busy} onClick={() => void join()}>{busy ? 'Saving your place…' : 'Join the crew'}<Icon /></button> : <><Link className="primary-button" to={`/signup?next=${next}`}>Create an account and join<Icon /></Link><Link className="auth-prompt-login" to={`/login?next=${next}`}>Already have an account? Sign in ↗</Link></>}</>}{error && <p role="alert" className="form-error">{error}</p>}<Link className="text-button" to="/">Back home</Link></div></section>
}
