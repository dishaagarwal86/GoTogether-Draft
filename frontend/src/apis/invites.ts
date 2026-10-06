const tokenKey = 'gotogether.session-token'
import { apiUrl } from '../services/apiUrl'
async function request<T>(path: string, options?: RequestInit) {
  const token = localStorage.getItem(tokenKey)
  const response = await fetch(apiUrl(path), { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers } })
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) throw new Error('The API returned a web page instead of data. Set VITE_API_URL to your Render backend URL and redeploy the frontend.')
  const body = await response.json() as { data?: T; error?: string }
  if (!response.ok) throw new Error(body.error ?? 'This invitation is unavailable.')
  return body.data as T
}
export type InviteDetails = { email: string; expiresAt: string; organiserName?: string; memberCount?: number; completedPreferences?: number; room: { id: string; name: string; trip_name: string } }
export type PendingInvite = { id: string; expiresAt: string; room: { id: string; name: string; trip_name: string } }
export const getInvite = (token: string) => request<InviteDetails>(`/invites/${token}`)
export const acceptInvite = (token: string) => request<{ id: string; name: string }>(`/invites/${token}/accept`, { method: 'POST' })
export const getMyInvites = () => request<PendingInvite[]>('/invites/mine')
export const joinInvite = (inviteId: string) => request<{ roomId: string }>(`/invites/${inviteId}/join`, { method: 'POST' })
export const saveGuestInvitePreferences = (token: string, guestSessionId: string, answers: Record<string, unknown>) => request<{ roomId: string }>(`/invites/${token}/guest-preferences`, { method: 'POST', body: JSON.stringify({ guestSessionId, answers }) })
export const claimGuestInvitePreferences = (token: string, guestSessionId: string) => request<{ id: string; name: string }>(`/invites/${token}/claim-guest`, { method: 'POST', body: JSON.stringify({ guestSessionId }) })
