import { apiUrl } from './apiUrl'
export const demoAvailable = import.meta.env.DEV && import.meta.env.VITE_LOCAL_PREVIEW === 'true'
export type DemoActor = { key: string; userId: string; firstName: string; lastName: string; city: string; role: string; story: string; color: string; budget: string; pace: string; start: string; must: string; moods: string[] }
export type DemoScene = { key: string; name: string; tab: string; roomId: string; description: string; guide: string[] }
export type QuestDemo = { createdAt: string; actors: DemoActor[]; scenes: DemoScene[] }
type ActiveDemo = { actorKey: string; userId: string; sceneKey: string }
const activeKey = 'gotogether.demo.active'
const previousKey = 'gotogether.demo.previous-session'
const tokenKey = 'gotogether.session-token'
const userKey = 'gotogether.current-user-id'
export function activeDemo(): ActiveDemo | null {
  try { return JSON.parse(sessionStorage.getItem(activeKey) ?? 'null') as ActiveDemo | null } catch { return null }
}
async function request<T>(path: string, input?: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), input ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) } : undefined)
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'The local demo is not available yet.')
  return body.data as T
}
export const getDemo = () => request<QuestDemo>('/demo')
async function endDemoSession() {
  const active = activeDemo()
  const token = localStorage.getItem(tokenKey)
  if (active?.userId !== localStorage.getItem(userKey) || !token) return
  await fetch(apiUrl('/auth/logout'), { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined)
}
export async function enterDemo(actorKey: string, scene: DemoScene, preserveTab = false) {
  const session = await request<{ user: { id: string }; token: string }>('/demo/session', { actorKey })
  // Keep the traveller's existing account available to restore on Exit demo.
  if (!sessionStorage.getItem(previousKey)) sessionStorage.setItem(previousKey, JSON.stringify({ token: localStorage.getItem(tokenKey), userId: localStorage.getItem(userKey) }))
  await endDemoSession()
  localStorage.setItem(tokenKey, session.token)
  localStorage.setItem(userKey, session.user.id)
  sessionStorage.setItem(activeKey, JSON.stringify({ actorKey, userId: session.user.id, sceneKey: scene.key }))
  const requested = new URLSearchParams(window.location.search).get('tab')
  const tab = preserveTab && ['crew', 'options', 'itinerary', 'ideas', 'chat'].includes(requested ?? '') ? requested : scene.tab
  window.location.assign(`/quests/${scene.roomId}?tab=${tab}`)
}
export async function exitDemo() {
  await endDemoSession()
  const previous = JSON.parse(sessionStorage.getItem(previousKey) ?? '{}') as { token?: string; userId?: string }
  for (const [key, value] of [[tokenKey, previous.token], [userKey, previous.userId]]) {
    if (value) localStorage.setItem(key!, value); else localStorage.removeItem(key!)
  }
  sessionStorage.removeItem(previousKey)
  sessionStorage.removeItem(activeKey)
  window.location.assign(previous.token ? '/trips' : '/demo')
}
