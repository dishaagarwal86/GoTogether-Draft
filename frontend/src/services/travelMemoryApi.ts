import { apiUrl } from './apiUrl'
import type { PlanCommand } from './workingPlanApi'

export const tripContexts = ['leisure', 'solo', 'partner', 'friends', 'family', 'work']
export const travelInterests = ['Food & Culture', 'Nature', 'History', 'Adventure', 'Relaxation', 'Wellness', 'Nightlife', 'Family fun', 'Shopping']
export const travelPaces = ['Slow & relaxed', 'A balanced mix', 'Busy & activity-filled']
export type TravelMemory = { id: string; feature: 'day_start' | 'pace' | 'interest' | 'avoid_activity'; value: string; context: string; source: 'edit' | 'import' | 'manual'; created_at: string }
export type LearningPrompt = { eventId: string; feature: string; value: string; label: string; context: string }
export type TravelProfile = { settings: { learningEnabled: boolean; useEnabled: boolean }; memories: TravelMemory[]; wallet: { points: number; credits: number; reserved: number }; imports: Array<{ id: string; status: string; title: string; destination: string; endDate: string; awardedPoints: number }>; ledger: Array<{ kind: string; points_delta: number; credits_delta: number; created_at: string }>; awardedPoints?: number }
export type PastTrip = { id: string; status?: string; title: string; destination: string; endDate: string; context: string; days: Array<{ title: string; notes: string }>; reflection: string; loved: string[]; pace: string; dayStart: string }
export type PlanProposal = { id: string; state: 'pending' | 'ready' | 'failed' | 'dismissed' | 'applied'; base_revision: number; credit_charged: boolean; data: { commands: PlanCommand[]; summary: string; changes: Array<{ before: string; after: string }>; source?: string; notice?: string; instruction?: string } }
export async function travelRequest<T>(path = '', body?: unknown, method = body ? 'POST' : 'GET'): Promise<T> {
  const response = await fetch(apiUrl(path), { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('gotogether.session-token') ?? ''}` }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(25000) })
  const value = await response.json().catch(() => null)
  if (!response.ok || !value || !('data' in value)) throw new Error(value?.error ?? 'We couldn’t save this right now. Your plan is safe; please try again.')
  return value.data as T
}
const base = '/me/travel-style'
export const getTravelProfile = () => travelRequest<TravelProfile>(base)
export const saveTravelSettings = (settings: Partial<TravelProfile['settings']>) => travelRequest<TravelProfile>(`${base}/settings`, settings, 'PATCH')
export const rememberEdit = (eventId: string, context: string) => travelRequest<TravelProfile>(`${base}/remember`, { eventId, context })
export const saveMemory = (feature: string, value: string, context: string) => travelRequest<TravelProfile>(`${base}/memories`, { feature, value, context })
export const forgetMemory = (id: string) => travelRequest<TravelProfile>(`${base}/memories/${encodeURIComponent(id)}`, undefined, 'DELETE')
export const resetMemories = () => travelRequest<TravelProfile>(`${base}/memories`, undefined, 'DELETE')
export const draftPastTrip = (text: string) => travelRequest<PastTrip>(`${base}/imports`, { text })
export const savePastTripDraft = (trip: PastTrip) => travelRequest<PastTrip>(`${base}/imports/${encodeURIComponent(trip.id)}`, trip, 'PATCH')
export const getPastTrip = (id: string) => travelRequest<PastTrip>(`${base}/imports/${encodeURIComponent(id)}`)
export const confirmPastTrip = (trip: PastTrip, remember: boolean) => travelRequest<TravelProfile>(`${base}/imports/${encodeURIComponent(trip.id)}/confirm`, { ...trip, completed: true, mine: true, remember })
export const removePastTrip = (id: string) => travelRequest<TravelProfile>(`${base}/imports/${encodeURIComponent(id)}`, undefined, 'DELETE')
export const redeemPoints = (requestId: string) => travelRequest<TravelProfile>(`${base}/redemptions`, { requestId })
export const getProposals = (roomId: string) => travelRequest<PlanProposal[]>(`/working-plans/${encodeURIComponent(roomId)}/proposals`)
export const proposeChange = (roomId: string, input: { expectedRevision: number; instruction: string; dayId?: string; requestId: string }) => travelRequest<PlanProposal>(`/working-plans/${encodeURIComponent(roomId)}/proposals`, input)
export const dismissProposal = (roomId: string, id: string) => travelRequest(`/working-plans/${encodeURIComponent(roomId)}/proposals/${encodeURIComponent(id)}/dismiss`, {})
export const memoryLabel = (memory: Pick<TravelMemory, 'feature' | 'value'>) => memory.feature === 'day_start' ? `Mornings around ${memory.value}` : memory.feature === 'avoid_activity' ? `Prefer to skip ${memory.value}` : memory.value
