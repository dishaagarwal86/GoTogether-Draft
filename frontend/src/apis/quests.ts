const sessionKey = 'gotogether.session-token'
export type Quest = { id: string; name: string; tripName: string; members: number; createdAt: string; role: 'owner' | 'member'; inviteStatus: string }
export type QuestMessage = { id: string; senderId: string; senderName: string; body: string; createdAt: string }
export type QuestRecommendation = { id: string; title: string; destination: string; country: string; duration_days: number; budget: string; estimated_cost_usd: number; seasons: string[]; moods: string[]; short_description: string; daily_plan: unknown; matchedPreferences: string[]; compromises: string[]; label: string }
export type QuestDna = { sharedVibe: string[]; budgetStyle: string; noGoActivities: string[] }
async function request<T>(path: string, options?: RequestInit) { const token = localStorage.getItem(sessionKey); const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers } }); const body = await response.json() as { data?: T; error?: string }; if (!response.ok) throw new Error(body.error ?? 'Could not load your quests.'); return body.data as T }
export const getUserQuests = (userId: string) => request<Quest[]>(`/users/${userId}/trip-rooms`)
export const inviteToQuest = (questId: string, email: string) => request<{ email: string; delivered: boolean; reason?: string }>(`/trip-rooms/${questId}/invites`, { method: 'POST', body: JSON.stringify({ email }) })
export const getQuestMessages = (questId: string) => request<QuestMessage[]>(`/trip-rooms/${questId}/messages`)
export const sendQuestMessage = (questId: string, body: string) => request<QuestMessage>(`/trip-rooms/${questId}/messages`, { method: 'POST', body: JSON.stringify({ body }) })
export const getQuestRecommendations = (questId: string) => request<{ travelDna: QuestDna | null; memberCount?: number; results: QuestRecommendation[] }>(`/recommendations/quests/${questId}`)
