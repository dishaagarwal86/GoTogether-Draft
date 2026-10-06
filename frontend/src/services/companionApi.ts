export type CompanionTask = 'extract' | 'group-dna' | 'explain'
export async function askCompanion(task: CompanionTask, message?: string, context?: unknown) {
  const response = await fetch('/api/companion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task, message, context }) })
  if (!response.ok) throw new Error('The Companion could not respond just now.')
  return response.json() as Promise<{ summary: string; source: 'openai' | 'ollama' | 'fallback'; extracted?: Record<string, unknown> }>
}
