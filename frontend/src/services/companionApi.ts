import { apiUrl } from './apiUrl'

export type CompanionTask = 'extract' | 'group-dna' | 'explain' | 'chat'
export type AiSource = 'openai' | 'ollama' | 'fallback'
export type Extraction = { moods?: string[]; budget?: string; pace?: string; mustHave?: string; noGo?: string; daysCount?: number }
export type CompanionReply = { id: string; summary: string; source: AiSource; notice?: string; extracted?: Extraction; message?: string; applied?: boolean; appliedFields?: string[]; itineraryId?: string; preferences?: unknown; createdAt?: string }
export type PersonalStory = { id: string; resultTitle: string; scrapbookIntro: string; whyItWorks: string[]; tradeoffNote: string; days: Array<{ day: number; note: string }>; source: AiSource; notice?: string }
type CompanionRequest = { task: CompanionTask; message?: string; roomId?: string; itineraryId?: string; preferences?: unknown; includeCrew?: boolean }
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('gotogether.session-token') ?? ''}` },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25000),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(result?.error ?? 'The Companion could not respond just now. Please try again.')
  return result as T
}
export const askCompanion = (input: CompanionRequest) => request<CompanionReply>('/companion', input)
export async function companionHistory(task: CompanionTask, roomId?: string) {
  const query = new URLSearchParams({ task, ...(roomId ? { roomId } : {}) })
  return (await request<{ data: CompanionReply[] }>(`/companion/history?${query}`)).data
}
export async function applyCompanionSuggestion(id: string, fields: string[], roomId: string) {
  await request(`/companion/${encodeURIComponent(id)}/apply`, { fields })
  window.dispatchEvent(new CustomEvent('gotogether:preferences-updated', { detail: roomId }))
}
export const personaliseItinerary = (roomId: string, itineraryId: string) => request<{ data: PersonalStory }>('/personalise-itinerary', { roomId, itineraryId })
export const savedPersonalStory = (roomId: string, itineraryId: string) => request<{ data: PersonalStory | null }>(`/personalise-itinerary?${new URLSearchParams({ roomId, itineraryId })}`)
export const sourceLabel = (source: AiSource) => source === 'fallback' ? 'Planning suggestion · AI unavailable' : `AI suggestion · ${source === 'openai' ? 'OpenAI' : 'Ollama'}`
