import { useEffect, useRef, useState, type FormEvent } from 'react'
import { inviteToQuest } from '../apis/quests'
import { getContacts, type Contact } from '../apis/contacts'
import { useAuth } from '../auth/AuthContext'
import { Icon } from './Ui'

export function QuestInviteDialog({ roomId, open, onClose }: { roomId: string; open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const dialog = useRef<HTMLDialogElement>(null)
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    const element = dialog.current
    element?.showModal(); document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }) }
  }, [open])
  useEffect(() => {
    if (!open || !user) return
    getContacts(user.id).then(setContacts).catch(() => setContacts([]))
  }, [open, user])
  const invite = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { const result = await inviteToQuest(roomId, email.trim()); setNotice(result.delivered ? `An invitation is on its way to ${result.email}.` : 'The invitation was saved, but the email could not be delivered. Please try sending it again later.'); if (result.delivered) setEmail('') }
    catch { setError('We couldn’t send the invitation. Please check the address and try again.') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="quest-invite-dialog" aria-labelledby="quest-invite-title" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}><button type="button" className="quest-invite-close" onClick={onClose} aria-label="Close invitation"><Icon name="close" /></button><span className="account-symbol"><Icon name="people" size={27} /></span><p className="eyebrow">THE GOOD PART IS THE TOGETHER PART</p><h2 id="quest-invite-title">Room for your people.</h2><p>Invite a friend to join this quest, share their travel style, and join the conversation.</p>{contacts.length > 0 && <section className="quest-contact-picker" aria-label="Saved contacts"><p>YOUR TRAVEL CIRCLE</p><div>{contacts.map(contact => <button type="button" key={contact.id} className={email === contact.email ? 'is-selected' : ''} onClick={() => setEmail(contact.email)}><span>{contact.name.slice(0, 1).toUpperCase()}</span><strong>{contact.name}</strong><small>{contact.email}</small></button>)}</div></section>}<form className="quest-invite-form" onSubmit={invite}><label htmlFor="invite-email">Their email address<input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="friend@example.com" required /></label>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="invite-success" role="status">{notice}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Sending their invitation…' : 'Invite to our quest'}<Icon /></button></form></dialog>
}
