import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
export type AppUser = { id: string; firstName: string; lastName: string; email: string; country: string | null; createdAt: string }
type Credentials = { email: string; password: string }
type SignUp = Credentials & { firstName: string; lastName: string; country?: string }
type ProfileInput = { firstName: string; lastName: string; country: string }
type Auth = { user: AppUser | null; ready: boolean; login: (input: Credentials) => Promise<void>; signup: (input: SignUp) => Promise<void>; updateProfile: (input: ProfileInput) => Promise<void>; logout: () => Promise<void>; requestSignIn: () => void; closeSignInPrompt: () => void; signInPromptOpen: boolean }
const Context = createContext<Auth | null>(null)
const key = 'gotogether.session-token'
async function api<T>(path: string, options?: RequestInit, token?: string | null) {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers } })
  const body = response.status === 204 ? null : await response.json().catch(() => null) as { data?: T; error?: string } | null
  if (!response.ok) throw new Error(body?.error || 'We couldn’t connect right now. Please try again in a moment.')
  return body?.data as T
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [ready, setReady] = useState(() => !localStorage.getItem(key))
  const [signInPromptOpen, setSignInPromptOpen] = useState(false)
  useEffect(() => {
    const token = localStorage.getItem(key)
    if (!token) { localStorage.removeItem('gotogether.current-user-id'); return }
    api<AppUser>('/auth/me', undefined, token).then((current) => { setUser(current); localStorage.setItem('gotogether.current-user-id', current.id) }).catch(() => { localStorage.removeItem(key); localStorage.removeItem('gotogether.current-user-id') }).finally(() => setReady(true))
  }, [])
  const apply = async (path: '/auth/login' | '/auth/signup', input: Credentials | SignUp) => {
    const result = await api<{ user: AppUser; token: string }>(path, { method: 'POST', body: JSON.stringify(input) })
    localStorage.setItem(key, result.token); localStorage.setItem('gotogether.current-user-id', result.user.id)
    // Keep the places a traveller saved while browsing before signing in.
    try {
      const guest = JSON.parse(localStorage.getItem('gotogether.saved.guest') ?? '[]') as unknown
      const savedKey = `gotogether.saved.${result.user.id}`
      const existing = JSON.parse(localStorage.getItem(savedKey) ?? '[]') as unknown
      if (Array.isArray(guest) && guest.length) {
        localStorage.setItem(savedKey, JSON.stringify([...new Set([...(Array.isArray(existing) ? existing : []), ...guest].filter((item) => typeof item === 'string'))]))
        localStorage.removeItem('gotogether.saved.guest')
      }
    } catch { /* Existing account access remains available if saved-place data is damaged. */ }
    setUser(result.user); setSignInPromptOpen(false)
  }
  const logout = async () => {
    const token = localStorage.getItem(key)
    try { if (token) await api('/auth/logout', { method: 'POST' }, token) }
    finally { localStorage.removeItem(key); localStorage.removeItem('gotogether.current-user-id'); setUser(null) }
  }
  const updateProfile = async (input: ProfileInput) => setUser(await api<AppUser>('/auth/me', { method: 'PATCH', body: JSON.stringify(input) }, localStorage.getItem(key)))
  return <Context.Provider value={{ user, ready, login: (input) => apply('/auth/login', input), signup: (input) => apply('/auth/signup', input), updateProfile, logout, requestSignIn: () => setSignInPromptOpen(true), closeSignInPrompt: () => setSignInPromptOpen(false), signInPromptOpen }}>{children}</Context.Provider>
}
// Auth is a shared context hook used alongside its provider.
// oxlint-disable-next-line react/only-export-components
export const useAuth = () => { const context = useContext(Context); if (!context) throw new Error('useAuth must be used within AuthProvider'); return context }
