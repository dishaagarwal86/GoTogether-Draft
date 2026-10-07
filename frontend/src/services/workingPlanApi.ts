import type { BookingTrip } from '../apis/quests'
import type { LearningPrompt } from './travelMemoryApi'
import { apiUrl } from './apiUrl'

export type PlanItem = { id: string; title: string; kind: 'experience' | 'food' | 'stay' | 'transport' | 'free'; time: string; duration: number; note: string; locked: boolean; imageQuery?: string }
export type PlanDay = { id: string; title: string; items: PlanItem[] }
export type WorkingPlan = { learningPrompt?: LearningPrompt | null; title: string; destination: string; country: string; catalogueId: string; days: PlanDay[]; bookings?: BookingTrip; revision: number; canUndo: boolean; updatedAt: string }
export type PlanCommand = { type: 'move' | 'add' | 'remove' | 'update' | 'lock' | 'undo' | 'rename' | 'proposal' | 'switch'; proposalId?: string; catalogueId?: string; itemId?: string; dayId?: string; index?: number; title?: string; kind?: PlanItem['kind']; time?: string; duration?: number; note?: string }
export class PlanError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status } }
async function request<T>(roomId: string, suffix = '', body?: unknown): Promise<T> {
  const response = await fetch(apiUrl(`/working-plans/${encodeURIComponent(roomId)}${suffix}`), { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('gotogether.session-token') ?? ''}` }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) })
  const value = await response.json()
  if (!response.ok) throw new PlanError(value.error || 'Your change could not be saved. Please try again.', response.status)
  return value.data as T
}
export const getWorkingPlan = (roomId: string) => request<WorkingPlan | null>(roomId)
export const startWorkingPlan = (roomId: string, catalogueId: string) => request<WorkingPlan>(roomId, '', { catalogueId })
export type QuestVotes = { members: Array<{ id: string; name: string; role: string }>; votes: Array<{ userId: string; name: string; itineraryId: string; isMe: boolean }> }
export type Confirmations = { memberCount: number; confirmations: Record<string, Array<{ userId: string; name: string; isMe: boolean }>> }
export type AreaIdea = { title: string; kind: PlanItem['kind']; note: string; area: string; imageQuery: string; category?: string }
export type IdeaCategory = { id: string; label: string; hint: string }
export const getVotes = (roomId: string) => request<QuestVotes>(roomId, '/votes')
export const castVote = (roomId: string, itineraryId: string) => request<QuestVotes>(roomId, '/votes', { itineraryId })
export const getConfirmations = (roomId: string) => request<Confirmations>(roomId, '/confirmations')
export const setConfirmation = (roomId: string, itemId: string, confirmed: boolean) => request<Confirmations>(roomId, '/confirmations', { itemId, confirmed })
export const getAreaIdeas = (roomId: string, destination: string, query = '') => request<{ ideas: AreaIdea[]; categories?: IdeaCategory[] }>(roomId, `/area-ideas?${new URLSearchParams({ destination, q: query })}`)
export const savePlanChange = (roomId: string, expectedRevision: number, requestId: string, command: PlanCommand) => request<WorkingPlan>(roomId, '/changes', { ...command, expectedRevision, requestId })

export function dayWarnings(day: PlanDay): string[] {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  const sorted = [...day.items].sort((a, b) => minutes(a.time) - minutes(b.time))
  const warnings = new Set<string>()
  let end = -1
  for (const item of sorted) {
    if (minutes(item.time) < end) warnings.add('Some suggested times overlap. Adjust the times before you travel.')
    end = Math.max(end, minutes(item.time) + item.duration)
    if (end > 1440) warnings.add('An activity runs into the next day. Check its start time and duration.')
  }
  if (day.items.some((item, i) => i > 0 && minutes(item.time) < minutes(day.items[i - 1].time))) warnings.add('Your card order differs from the suggested times. Moving a card keeps its time unchanged.')
  return [...warnings]
}
