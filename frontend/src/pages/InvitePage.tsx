import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { acceptInvite, getInvite, type InviteDetails } from '../apis/invites'
import { useAuth } from '../auth/AuthContext'

export function InvitePage() {
  const { token = '' } = useParams(); const { user, ready } = useAuth()
  const [invite, setInvite] = useState<InviteDetails | null>(null); const [error, setError] = useState(''); const [accepted, setAccepted] = useState(false)
  useEffect(() => { if (!token) return; getInvite(token).then(setInvite).catch((reason: Error) => setError(reason.message)) }, [token])
  useEffect(() => { if (!user || !token || accepted || error) return; acceptInvite(token).then(() => setAccepted(true)).catch((reason: Error) => setError(reason.message)) }, [accepted, error, token, user])
  const next = encodeURIComponent(`/invite/${token}`)
  if (error) return <section className="auth-page"><div className="auth-card"><p className="eyebrow">INVITATION</p><h1>This link is <em>unavailable.</em></h1><p>{error}</p><Link className="primary-button" to="/">Back home <span>→</span></Link></div></section>
  if (!invite || !ready) return <section className="auth-page"><div className="auth-card"><p className="eyebrow">GO.TOGETHER</p><h1>Opening your <em>invitation…</em></h1></div></section>
  if (accepted) return <section className="auth-page"><div className="auth-card"><p className="eyebrow">YOU’RE IN</p><h1>Welcome to <em>{invite.room.name}.</em></h1><p>Your quest is ready whenever you are.</p><Link className="primary-button" to="/plan">See your quests <span>→</span></Link></div></section>
  if (!user) return <section className="auth-page"><div className="auth-card"><p className="eyebrow">YOU’RE INVITED</p><h1>Join <em>{invite.room.name}.</em></h1><p>Sign in or create an account with <strong>{invite.email}</strong> to join this quest.</p><div className="invite-actions"><Link className="primary-button" to={`/signup?next=${next}`}>Create an account <span>→</span></Link><Link className="auth-prompt-login" to={`/login?next=${next}`}>I already have an account</Link></div></div></section>
  return null
}
