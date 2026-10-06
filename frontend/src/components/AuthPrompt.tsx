import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
export function AuthPrompt() {
  const { signInPromptOpen, closeSignInPrompt } = useAuth()
  const location = useLocation()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!signInPromptOpen) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    dialog.current?.showModal(); document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [signInPromptOpen])
  if (!signInPromptOpen) return null
  const next = encodeURIComponent(location.pathname + location.search)
  return <dialog className="journey-dialog auth-prompt" ref={dialog} aria-labelledby="auth-prompt-title" onCancel={closeSignInPrompt}><button className="auth-prompt-close" type="button" aria-label="Close" onClick={closeSignInPrompt} autoFocus>×</button><p className="eyebrow">YOUR JOURNEY STARTS HERE</p><h2 id="auth-prompt-title">A home for the plans you share.</h2><p>Create an account to shape a quest and keep your people’s ideas together.</p><div><Link className="primary-button" to={`/signup?next=${next}`} onClick={closeSignInPrompt}>Create an account →</Link><Link className="auth-prompt-login" to={`/login?next=${next}`} onClick={closeSignInPrompt}>I already have an account</Link></div></dialog>
}
