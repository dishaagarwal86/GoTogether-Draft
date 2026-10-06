const sessionKey = 'gotogether.session-token'
export type Quest = { id: string; name: string; tripName: string; members: number; createdAt: string; role: 'owner' | 'member'; inviteStatus: string }
async function request<T>(path: string, options?: RequestInit) { const token = localStorage.getItem(sessionKey); const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers } }); const body = await response.json() as { data?: T; error?: string }; if (!response.ok) throw new Error(body.error ?? 'Could not load your quests.'); return body.data as T }
export const getUserQuests = (userId: string) => request<Quest[]>(`/users/${userId}/trip-rooms`)
export const inviteToQuest = (questId: string, email: string) => request<{ email: string; delivered: boolean; reason?: string }>(`/trip-rooms/${questId}/invites`, { method: 'POST', body: JSON.stringify({ email }) })
