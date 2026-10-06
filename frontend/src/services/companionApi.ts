import { apiUrl } from './apiUrl'
export type CompanionTask = 'extract' | 'group-dna' | 'explain'
export async function askCompanion(task: CompanionTask, message?: string, context?: unknown) {
  const response = await fetch(apiUrl('/companion'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task, message, context }) })
  if (!response.ok) throw new Error('The Companion could not respond just now.')
  return response.json() as Promise<{ summary: string; source: 'openai' | 'ollama' | 'fallback'; extracted?: Record<string, unknown> }>
}
export async function personaliseItinerary(groupTravelDNA: unknown, itinerary: unknown, deterministicReasoning: unknown) {
  const response = await fetch(apiUrl('/personalise-itinerary'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupTravelDNA, itinerary, deterministicReasoning }) })
  if (!response.ok) throw new Error('Could not personalise this itinerary.')
  return response.json() as Promise<{ data: { resultTitle: string; scrapbookIntro: string; whyItWorks: string[]; tradeoffNote: string; days: Array<{ day: number; title: string; description: string; highlights: string[]; mood: string }> } }>
}
