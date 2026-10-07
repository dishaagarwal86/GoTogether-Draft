import { useEffect, useState, type FormEvent } from 'react'
import { getContacts, inviteContact, removeContact, type Contact } from '../apis/contacts'
import { useAuth } from '../auth/AuthContext'
import { Icon } from './Ui'

export function ContactsPanel() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    let active = true
    getContacts(userId).then(value => { if (active) setContacts(value) }).catch(() => { if (active) setError('We couldn’t load your contacts right now.') })
    return () => { active = false }
  }, [userId])
  const invite = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await inviteContact(user.id, { name, email })
      setContacts((items) => [result.contact, ...items.filter((item) => item.id !== result.contact.id)])
      setNotice(result.delivered ? `An invitation is on its way to ${result.contact.name}.` : `${result.contact.name} is saved to your contacts. Email delivery is not configured yet.`)
      setName(''); setEmail('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We couldn’t save this contact.') }
    finally { setBusy(false) }
  }
  const remove = async (contact: Contact) => {
    if (!user) return
    try { await removeContact(user.id, contact.id); setContacts((items) => items.filter((item) => item.id !== contact.id)) }
    catch { setError('We couldn’t remove this contact.') }
  }
  return <section className="contacts-panel" aria-labelledby="contacts-title">
    <div><p className="eyebrow">YOUR PEOPLE</p><h2 id="contacts-title">Keep your travel circle close.</h2><p>Invite someone now, then add them to a future quest in one click.</p></div>
    <form onSubmit={invite} className="contacts-form"><label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Mira" maxLength={80} /></label><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="mira@example.com" required /></label><button className="primary-button" disabled={busy} type="submit">{busy ? 'Sending…' : 'Invite to GoTogether'} <Icon size={16} /></button></form>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="invite-success" role="status">{notice}</p>}
    {contacts.length > 0 && <div className="contacts-list">{contacts.map((contact) => <article key={contact.id}><span>{contact.name.slice(0, 1).toUpperCase()}</span><div><strong>{contact.name}</strong><small>{contact.email}</small></div><button type="button" onClick={() => void remove(contact)} aria-label={`Remove ${contact.name}`}>×</button></article>)}</div>}
  </section>
}
