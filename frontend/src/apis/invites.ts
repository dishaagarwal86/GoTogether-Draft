const tokenKey = 'gotogether.session-token'
async function request<T>(path: string, options?: RequestInit) {
  const token = localStorage.getItem(tokenKey)
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers } })
  const body = await response.json() as { data?: T; error?: string }
  if (!response.ok) throw new Error(body.error ?? 'This invitation is unavailable.')
  return body.data as T
}
export type InviteDetails = { email: string; expiresAt: string; room: { id: string; name: string; trip_name: string } }
export type PendingInvite = { id: string; expiresAt: string; room: { id: string; name: string; trip_name: string } }
export const getInvite = (token: string) => request<InviteDetails>(`/invites/${token}`)
export const acceptInvite = (token: string) => request<{ id: string; name: string }>(`/invites/${token}/accept`, { method: 'POST' })
export const getMyInvites = () => request<PendingInvite[]>('/invites/mine')
export const joinInvite = (inviteId: string) => request<{ roomId: string }>(`/invites/${inviteId}/join`, { method: 'POST' })
