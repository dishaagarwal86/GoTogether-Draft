import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyInvites, joinInvite, type PendingInvite } from '../apis/invites'
import { Icon } from './Ui'

export function QuestInvitations() {
  const [open, setOpen] = useState(false)
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState('')
  const [revision, setRevision] = useState(0)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const mounted = useRef(false)
  const navigate = useNavigate()

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let active = true
    let inFlight = false
    const refresh = async () => {
      if (inFlight || document.hidden) return
      inFlight = true
      try { const items = await getMyInvites(); if (active) { setInvites(items); setLoadError('') } }
      catch { if (active) setLoadError('Your invitations couldn’t refresh. Please try again.') }
      finally { if (active) setLoading(false); inFlight = false }
    }
    void refresh()
    const timer = window.setInterval(refresh, 30_000)
    const whenVisible = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', whenVisible)
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', whenVisible) }
  }, [open, revision])
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', escape) }
  }, [open])
  const join = async (invite: PendingInvite) => {
    if (joining) return
    setJoining(invite.id); setJoinError('')
    try {
      const result = await joinInvite(invite.id)
      if (!mounted.current) return
      setInvites((current) => current.filter((item) => item.id !== invite.id))
      setOpen(false)
      navigate(`/quests/${result.roomId}`)
    } catch { if (mounted.current) setJoinError('We couldn’t join this quest. Refresh your invitations or try joining again.') }
    finally { if (mounted.current) setJoining('') }
  }

  return <div className="journey-invitations" ref={container}>
    <button className="journey-invite-trigger" type="button" ref={trigger} onClick={() => setOpen((value) => !value)} aria-label={`Invitations${invites.length ? `, ${invites.length} pending` : ''}`} aria-expanded={open} aria-controls="quest-invitations"><Icon name="bell" size={20} />{invites.length > 0 && <b>{invites.length}</b>}</button>
    {open && <section className="journey-invite-menu" id="quest-invitations" aria-labelledby="quest-invitations-title">
      <p className="eyebrow">GOOD COMPANY IS CALLING</p><h2 id="quest-invitations-title">Quest invitations</h2>
      {loading && <p role="status">Checking your invitations…</p>}
      {loadError && <p className="form-error" role="status">{loadError}<button type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button></p>}
      {!loading && !loadError && !invites.length && <p>You’re all caught up. New invitations will appear here.</p>}
      {invites.map((invite) => <article key={invite.id}><strong>{invite.room.name}</strong><small>{invite.room.trip_name}</small><button type="button" className="text-button" disabled={Boolean(joining)} onClick={() => void join(invite)}>{joining === invite.id ? 'Joining…' : 'Join quest'}<Icon size={16} /></button></article>)}
      {joinError && <p className="form-error" role="alert">{joinError}</p>}
    </section>}
  </div>
}
