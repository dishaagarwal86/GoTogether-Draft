import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { acceptInvite, claimGuestInvitePreferences, getInvite, saveGuestInvitePreferences, type InviteDetails } from '../apis/invites'
import { guestJourney, guestRespond, type QuestJourney, type JourneyVote } from '../apis/quests'
import { preferencePayload } from '../apis/travelDna'
import { useAuth } from '../auth/AuthContext'
import { Icon, LoadingState } from '../components/Ui'
import { PreferenceCards } from '../components/MemberPreferences'
import { GroupOptions, GroupResponses } from '../components/GroupOptions'
import { readStored, writeStored } from '../services/journeyStorage'

const sessionKey = (token: string) => `gotogether.guest-invite.${token}`
export function JoinQuestPage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, ready } = useAuth()
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [screen, setScreen] = useState<'landing' | 'form' | 'complete'>(() => readStored(`${sessionKey(token)}.submitted`, false) ? 'complete' : 'landing')
  const [error, setError] = useState('')
  const [saving, setBusy] = useState(false)
  const busy = saving || Boolean(user && params.get('claim') && !error)
  const [journey, setJourney] = useState<QuestJourney | null>(null)
  const [revision, setRevision] = useState(0)
  const guestSessionId = useMemo(() => { const stored = readStored<string | null>(sessionKey(token), null); if (stored) return stored; try { const legacy = localStorage.getItem(sessionKey(token)); if (legacy && /^[a-f0-9-]{36}$/i.test(legacy)) { writeStored(sessionKey(token), legacy); return legacy } } catch { /* Storage may be unavailable. */ } const next = crypto.randomUUID(); writeStored(sessionKey(token), next); return next }, [token])
  useEffect(() => { let active = true; getInvite(token).then(value => { if (active) setInvite(value) }).catch((reason: Error) => { if (active) setError(reason.message) }); return () => { active = false } }, [token])
  useEffect(() => {
    if (!user || !params.get('claim')) return
    let active = true
    claimGuestInvitePreferences(token, params.get('claim')!).then(room => { if (active) { try { localStorage.removeItem(sessionKey(token)); localStorage.removeItem(`${sessionKey(token)}.submitted`) } catch { /* Account claim is already saved. */ }; navigate(`/quests/${room.id}?tab=crew`, { replace: true }) } }).catch((reason: Error) => { if (active) setError(reason.message) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [user, token, params, navigate])
  useEffect(() => {
    if (screen !== 'complete' || params.get('claim')) return
    let active = true; let fetching = false
    const refresh = async () => { if (fetching || document.hidden) return; fetching = true; try { const value = await guestJourney(token, guestSessionId); if (active) { setJourney(value); setError('') } } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'The group could not refresh.') } finally { fetching = false } }
    void refresh(); const timer = window.setInterval(refresh, 6000)
    return () => { active = false; window.clearInterval(timer) }
  }, [screen, token, guestSessionId, revision, params])
  const join = async () => { if (!user || busy) return; setBusy(true); try { const room = await acceptInvite(token); navigate(`/quests/${room.id}?tab=crew&preferences=1`, { replace: true }) } catch (reason) { setError(reason instanceof Error ? reason.message : 'This invitation could not be accepted.') } finally { setBusy(false) } }
  const respond = async (response: JourneyVote) => { if (busy) return; setBusy(true); try { await guestRespond(token, guestSessionId, response); setRevision(value => value + 1) } catch (reason) { setRevision(value => value + 1); throw reason } finally { setBusy(false) } }
  if (!ready || (!invite && !error)) return <LoadingState label="Opening your invitation…" />
  if (error && !invite) return <section className="auth-page"><div className="auth-card"><h1>This invitation is <em>unavailable.</em></h1><p>{error}</p><Link className="primary-button" to="/">Back home <Icon /></Link></div></section>
  const profileNext = encodeURIComponent(`/join/${token}?claim=${guestSessionId}`)
  if (screen === 'form') return <section className="guest-group-room"><PreferenceCards guest storageKey={`${sessionKey(token)}.draft`} onCancel={() => setScreen('landing')} onSave={async answers => { await saveGuestInvitePreferences(token, guestSessionId, { ...preferencePayload(answers, invite!.room.id), displayName: answers.displayName || 'Guest traveller' }); writeStored(`${sessionKey(token)}.submitted`, true); setScreen('complete') }} /></section>
  if (screen === 'complete') return <section className="guest-group-room"><header><p className="eyebrow">YOUR VOICE IS INCLUDED</p><h1>{invite!.room.name}</h1><p>Your preferences count towards the group’s matches now. You can compare and respond here without creating an account.</p><button className="secondary-button" onClick={() => setScreen('form')}>Update my preferences<Icon name="sliders" size={16} /></button><p><Link to={`/signup?email=${encodeURIComponent(invite!.email)}&next=${profileNext}`}>Create a profile to join Crew chat and save your travel personality ↗</Link></p></header>{error && <p className="form-error" role="alert">{error}</p>}{journey ? <><GroupOptions journey={journey} busy={busy} onRespond={respond} currentId={journey.currentPlan?.catalogueId} />{journey.currentPlan && <section className="group-itinerary-detail"><p className="eyebrow">YOUR CREW’S SAVED PLAN</p><h2>{journey.currentPlan.title}</h2>{journey.currentPlan.days.map(day => <section className="group-preview-day" key={day.id}><h3>{day.title}</h3>{day.items.map(item => <p key={item.id}>{item.time} · {item.title}{item.note && ` — ${item.note}`}</p>)}</section>)}{journey.planReview?.canConfirm && <GroupResponses key={journey.planReview.version} response={journey.planReview} busy={busy} onRespond={(reaction, note) => respond({ kind: 'plan', version: journey.planReview!.version, reaction, note })} />}</section>}</> : <LoadingState label="Checking your crew’s progress…" />}</section>
  return <section className="auth-page"><div className="auth-card join-quest-card"><span className="account-symbol"><Icon name="people" size={28} /></span><p className="eyebrow">A SHARED PLAN STARTS HERE</p><h1>You’ve been invited to <em>{invite!.room.name}.</em></h1><p>Organised by {invite!.organiserName}. {invite!.completedPreferences ?? 0} of {invite!.memberCount ?? 1} travellers have added their preferences.</p><p>Your voice helps choose the destination and shape the days.</p>{user ? <button type="button" className="primary-button" disabled={busy} onClick={() => void join()}>{busy ? 'Joining…' : 'Join and share my travel style'} <Icon /></button> : <button type="button" className="primary-button" onClick={() => setScreen('form')}>Add my travel style <Icon /></button>}{error && <p className="form-error" role="alert">{error}</p>}</div></section>
}
