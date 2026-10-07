import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getJoinLink, inviteToQuest } from '../apis/quests'
import { getContacts, type Contact } from '../apis/contacts'
import { useAuth } from '../auth/AuthContext'
import { Icon } from './Ui'

export function QuestInviteDialog({ roomId, open, onClose }: { roomId: string; open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const dialog = useRef<HTMLDialogElement>(null)
  const [email, setEmail] = useState('')
  const [url, setUrl] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    let active = true
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    const element = dialog.current
    element?.showModal(); document.body.style.overflow = 'hidden'
    getJoinLink(roomId).then(value => { if (active) { setUrl(value.url); setError('') } }).catch(() => { if (active) setError('The share link could not load. Email invitations are still available.') })
    return () => { active = false; element?.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }) }
  }, [open, roomId])
  useEffect(() => {
    if (!open || !user) return
    let active = true
    getContacts(user.id).then(value => { if (active) setContacts(value) }).catch(() => { if (active) setContacts([]) })
    return () => { active = false }
  }, [open, user])
  const copy = async () => { try { await navigator.clipboard.writeText(url); setNotice('Invitation link copied. Share it with your crew.'); setError('') } catch { setNotice('Select and copy the link above to share it.') } }
  const invite = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { const result = await inviteToQuest(roomId, email.trim()); setNotice(result.delivered ? `An invitation is on its way to ${result.email}.` : `An invitation for ${result.email} was saved. Email delivery is unavailable; copy their personal link below.`); if (!result.delivered) setUrl(result.inviteUrl); setEmail('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'We couldn’t send the invitation. Please try again.') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="quest-invite-dialog" aria-labelledby="quest-invite-title" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}><button type="button" className="quest-invite-close" onClick={onClose} aria-label="Close invitation"><Icon name="close" /></button><span className="account-symbol"><Icon name="people" size={27} /></span><p className="eyebrow">GOOD COMPANY STARTS HERE</p><h2 id="quest-invite-title">Room for your people.</h2><p>Share a link in your group chat, or invite a friend by email. Everyone adds their own travel style.</p>{url && <div className="group-share-link"><label>Invitation link<input readOnly value={url} onFocus={event => event.target.select()} /></label><button className="secondary-button" type="button" onClick={() => void copy()}>Copy invite link<Icon name="arrow" size={16} /></button><small>Anyone with the group link can sign in and join. Personal email links are for their named recipient.</small></div>}{contacts.length > 0 && <section className="quest-contact-picker" aria-label="Saved contacts"><p>YOUR TRAVEL CIRCLE</p><div>{contacts.map(contact => <button type="button" key={contact.id} className={email === contact.email ? 'is-selected' : ''} onClick={() => setEmail(contact.email)}><span>{contact.name.slice(0, 1).toUpperCase()}</span><strong>{contact.name}</strong><small>{contact.email}</small></button>)}</div></section>}<form className="quest-invite-form" onSubmit={invite}><label htmlFor="invite-email">Or invite by email<input id="invite-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="friend@example.com" required /></label>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="invite-success" role="status">{notice}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Sending their invitation…' : 'Invite to our quest'}<Icon /></button></form></dialog>
}
