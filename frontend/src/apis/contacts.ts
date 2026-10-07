import { apiUrl } from '../services/apiUrl'

const sessionKey = 'gotogether.session-token'
export type Contact = { id: string; name: string; email: string; invitedAt?: string }

async function request<T>(path: string, options?: RequestInit) {
  const token = localStorage.getItem(sessionKey)
  const response = await fetch(apiUrl(path), { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers } })
  const body = response.status === 204 ? null : await response.json().catch(() => null) as { data?: T; error?: string } | null
  if (!response.ok) throw new Error(body?.error ?? 'We couldn’t update your contacts.')
  return body?.data as T
}

export const getContacts = (userId: string) => request<Contact[]>(`/users/${userId}/contacts`)
export const inviteContact = (userId: string, contact: { name?: string; email: string }) => request<{ contact: Contact; delivered: boolean; reason?: string }>(`/users/${userId}/contacts/invite`, { method: 'POST', body: JSON.stringify(contact) })
export const removeContact = (userId: string, contactId: string) => request<void>(`/users/${userId}/contacts/${contactId}`, { method: 'DELETE' })
