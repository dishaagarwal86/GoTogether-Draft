import { useEffect, useRef, useState, type FormEvent } from 'react'
import { inviteToQuest } from '../apis/quests'
import { Icon } from './Ui'

export function QuestInviteDialog({ roomId, open, onClose }: { roomId: string; open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    const element = dialog.current
    element?.showModal(); document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }) }
  }, [open])
  const invite = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { const result = await inviteToQuest(roomId, email.trim()); setNotice(result.delivered ? `An invitation is on its way to ${result.email}.` : 'The invitation was saved, but the email could not be delivered. Please try sending it again later.'); if (result.delivered) setEmail('') }
    catch { setError('We couldn’t send the invitation. Please check the address and try again.') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="quest-invite-dialog" aria-labelledby="quest-invite-title" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}><button type="button" className="quest-invite-close" onClick={onClose} aria-label="Close invitation"><Icon name="close" /></button><span className="account-symbol"><Icon name="people" size={27} /></span><p className="eyebrow">THE GOOD PART IS THE TOGETHER PART</p><h2 id="quest-invite-title">Room for your people.</h2><p>Invite a friend to join this quest, share their travel style, and join the conversation.</p><form className="quest-invite-form" onSubmit={invite}><label htmlFor="invite-email">Their email address<input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="friend@example.com" required /></label>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="invite-success" role="status">{notice}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Sending their invitation…' : 'Invite to our quest'}<Icon /></button></form></dialog>
}
