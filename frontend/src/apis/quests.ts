const sessionKey = 'gotogether.session-token'
import { apiUrl } from '../services/apiUrl'
export type Quest = { id: string; name: string; tripName: string; members: number; createdAt: string; role: 'owner' | 'member'; inviteStatus: string }
export type QuestMessage = { id: string; senderId: string; senderName: string; body: string; createdAt: string }
export type QuestNote = { id: string; type: 'activity' | 'mood' | 'budget' | 'accommodation' | 'no_go'; suggestion: string; proposedAction: string; confidence: number; mentionedBy: string[]; messageIds: string[]; groupSupportCount: number; requiresGroupConfirmation: true; status: 'suggested' | 'accepted' | 'dismissed'; chosenAction: string | null }
export type TripFlight = { from: string; fromCode: string; to: string; toCode: string; airline: string; flightNumber: string; departDate: string; departTime: string; arriveTime: string; duration: string; stops: number; returnDate: string; returnDepartTime: string; pricePerPerson: number }
export type TripStay = { name: string; type: string; area: string; stars: number; reviewScore: number; reviewLabel: string; highlights: string[]; pricePerNight: number; nights: number; totalPrice: number; imageQuery: string }
export type QuestRecommendation = { id: string; title: string; destination: string; country: string; duration_days: number; budget: string; estimated_cost_usd: number; seasons: string[]; moods: string[]; location_type: string; short_description: string; daily_plan: unknown; matchedPreferences: string[]; compromises: string[]; label: string; score?: number; personalFit?: number | null; source?: 'ai'; why_it_fits?: string; currency?: string; travel_dates?: { start: string; end: string }; cover_image?: string | null; flights?: TripFlight[]; stays?: TripStay[] }
export type BookingTrip = Pick<QuestRecommendation, 'destination' | 'duration_days' | 'budget' | 'location_type' | 'estimated_cost_usd' | 'currency' | 'travel_dates' | 'flights' | 'stays' | 'cover_image'>
export type QuestDna = { sharedVibe: string[]; budgetStyle: string; noGoActivities: string[]; departureCities?: string[]; groupSize?: number }
export type QuestReadinessOption = { id: 'comfort' | 'experiences'; title: string; summary: string; detail: string; outcome: string }
export type QuestReadiness = { totalMembers: number; completedMembers: number; readinessState: 'gathering' | 'deciding' | 'unlocked'; mainTension: string | null; recommendedAction: string; options: QuestReadinessOption[]; selectedOption: string | null; explanation: string }
export type PickType = 'flight' | 'stay' | 'activity' | 'itinerary'
export type PickReaction = 'love' | 'works' | 'not_for_me'
export type GroupFit = { responseCount: number; loveCount: number; worksCount: number; notForMeCount: number; missingResponses: number; hardConflict: boolean; status: 'aligned' | 'nearly_aligned' | 'needs_alignment' | 'waiting' }
export type QuestPick = { id: string; type: PickType; title: string; destination: string | null; estimatedPrice: number | null; note: string | null; link: string | null; imageUrl: string | null; createdAt: string; shared: boolean }
export type SharedPick = Omit<QuestPick, 'shared'> & { addedBy: { id: string; name: string }; groupFit: GroupFit; reactions: { userId: string; name: string; reaction: PickReaction | null; note: string | null; isMe: boolean }[] }
export type ShortlistData = { myPicks: QuestPick[]; sharedShortlist: SharedPick[]; members: { id: string; name: string }[] }
async function request<T>(path: string, options?: RequestInit) { const token = localStorage.getItem(sessionKey); const response = await fetch(apiUrl(path), { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers } }); const body = await response.json() as { data?: T; error?: string }; if (!response.ok) throw new Error(body.error ?? 'Could not load your quests.'); return body.data as T }
export const getUserQuests = (userId: string) => request<Quest[]>(`/users/${userId}/trip-rooms`)
export const inviteToQuest = (questId: string, email: string) => request<{ email: string; delivered: boolean; reason?: string; inviteUrl: string }>(`/trip-rooms/${questId}/invites`, { method: 'POST', body: JSON.stringify({ email }) })
export const getQuestMessages = (questId: string) => request<QuestMessage[]>(`/trip-rooms/${questId}/messages`)
export const sendQuestMessage = (questId: string, body: string) => request<QuestMessage>(`/trip-rooms/${questId}/messages`, { method: 'POST', body: JSON.stringify({ body }) })
export const getQuestNotes = (questId: string) => request<{ enabled: boolean; notes: QuestNote[] }>(`/trip-rooms/${questId}/quest-notes`)
export const setQuestNotesEnabled = (questId: string, enabled: boolean) => request<{ enabled: boolean }>(`/trip-rooms/${questId}/quest-notes`, { method: 'PATCH', body: JSON.stringify({ enabled }) })
export const analyseQuestNotes = (questId: string) => request<{ note: QuestNote | null; privateSuggestion: Omit<QuestNote, 'id' | 'status' | 'chosenAction'> | null }>(`/trip-rooms/${questId}/quest-notes/analyse`, { method: 'POST' })
export const applyQuestNote = (questId: string, noteId: string, action: 'must_have' | 'nice_to_have') => request<QuestNote>(`/trip-rooms/${questId}/quest-notes/${noteId}/apply`, { method: 'POST', body: JSON.stringify({ action }) })
export const dismissQuestNote = (questId: string, noteId: string) => request<{ ok: boolean }>(`/trip-rooms/${questId}/quest-notes/${noteId}/dismiss`, { method: 'POST' })
export const getQuestRecommendations = (questId: string) => request<{ travelDna: QuestDna | null; memberCount?: number; totalMembers?: number; blockers?: string[]; preferenceVersion?: string; questReadiness: QuestReadiness; results: QuestRecommendation[] }>(`/recommendations/quests/${questId}`)
export const getQuestShortlist = (questId: string) => request<ShortlistData>(`/trip-rooms/${questId}/shortlist`)
export const createQuestPick = (questId: string, pick: { type: PickType; title: string; destination?: string; estimatedPrice?: number | ''; note?: string; link?: string }) => request<{ id: string }>(`/trip-rooms/${questId}/picks`, { method: 'POST', body: JSON.stringify(pick) })
export const shareQuestPick = (questId: string, pickId: string) => request<{ ok: true }>(`/trip-rooms/${questId}/picks/${pickId}/share`, { method: 'POST' })
export const reactToQuestPick = (questId: string, sharedPickId: string, reaction: PickReaction, note?: string) => request<{ ok: true }>(`/trip-rooms/${questId}/shared-picks/${sharedPickId}/reaction`, { method: 'POST', body: JSON.stringify({ reaction, note }) })

export type JourneyPerson = { id: string; name: string; role: string; status: 'invited' | 'expired' | 'joined' | 'ready'; inviteId?: string }
export type JourneyResponse = { people: { id: string; name: string; isMe: boolean; reaction: 'love' | 'works' | 'concern' | null; note: string }[]; answered: number; concerns: number; agreed: boolean }
export type QuestJourney = { generationPending?: boolean; currentPlan: Pick<import('../services/workingPlanApi').WorkingPlan, 'title' | 'catalogueId' | 'destination' | 'country' | 'days'> | null; ready: boolean; participants: JourneyPerson[]; totalMembers: number; memberCount: number; results: QuestRecommendation[]; allResults: QuestRecommendation[]; travelDna: QuestDna | null; blockers: string[]; preferenceVersion: string; questReadiness: QuestReadiness; availability: { start: string | null; end: string | null; days: number | null; conflict: boolean }; options: Record<string, JourneyResponse>; planReview: (JourneyResponse & { version: string; revision: number; preferencesChanged: boolean; canConfirm: boolean; status: 'agreed' | 'review' }) | null }
export const getQuestJourney = (id: string) => request<QuestJourney>(`/trip-rooms/${id}/journey`)
export type JourneyVote = { kind: 'option' | 'plan'; optionId?: string; version: string; reaction: 'love' | 'works' | 'concern'; note?: string }
export const respondToJourney = (id: string, body: JourneyVote) => request<{ ok: boolean }>(`/trip-rooms/${id}/responses`, { method: 'POST', body: JSON.stringify(body) })
export const getJoinLink = (id: string, rotate = false) => request<{ url: string }>(`/trip-rooms/${id}/join-link`, { method: 'POST', body: JSON.stringify({ rotate }) })
export const manageCrew = (id: string, body: { action: 'resize' | 'remove'; members?: number; participantId?: string }) => request<{ ok: boolean }>(`/trip-rooms/${id}/crew`, { method: 'POST', body: JSON.stringify(body) })
export const sharedInvitation = (token: string) => request<{ roomId: string; name: string; host: string; totalMembers: number; completedMembers: number }>(`/join-room/${token}`)
export const joinSharedRoom = (token: string) => request<{ roomId: string }>(`/join-room/${token}`, { method: 'POST' })
export const guestJourney = (token: string, guestSessionId: string) => request<QuestJourney>(`/invites/${token}/journey`, { method: 'POST', body: JSON.stringify({ guestSessionId }) })
export const guestRespond = (token: string, guestSessionId: string, response: JourneyVote) => request<{ ok: boolean }>(`/invites/${token}/response`, { method: 'POST', body: JSON.stringify({ guestSessionId, response }) })

export const createQuest = (name: string, members: number, inviteEmail?: string) => request<Quest>('/trip-rooms', { method: 'POST', body: JSON.stringify({ name, tripName: name, members, inviteEmail }) })

export const changeTravelMode = (id: string, mode: 'solo' | 'group', requestId: string) => request<{ roomId: string; copied: boolean; mode: 'solo' | 'group' }>(`/trip-rooms/${id}/travel-mode`, { method: 'POST', body: JSON.stringify({ mode, requestId }) })
