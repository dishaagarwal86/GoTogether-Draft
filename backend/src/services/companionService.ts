import OpenAI from 'openai'

type CompanionRequest = {
  task: 'extract' | 'group-dna' | 'explain'
  message?: string
  context?: unknown
}

const fallback = (request: CompanionRequest) => {
  if (request.task === 'extract') {
    const words = (request.message ?? '').toLowerCase()
    const moods = ['adventure', 'food', 'culture', 'relaxation', 'nature', 'nightlife', 'wellness'].filter((mood) => words.includes(mood))
    return { summary: 'I picked up the travel notes below. Review them before saving.', extracted: { moods, notes: request.message ?? '' } }
  }
  if (request.task === 'group-dna') return { summary: 'Your group leans toward shared discovery, with space for different travel rhythms.' }
  return { summary: 'This path keeps the group’s strongest shared preferences in view while protecting time for everyone to enjoy the journey.' }
}

export async function askCompanion(request: CompanionRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { ...fallback(request), source: 'fallback' as const }

  const client = new OpenAI({ apiKey })
  const prompt = `You are the GoTogether Companion for group travel. Be warm, concise and practical. Never claim to calculate scores or make bookings. Return valid JSON only with a single \"summary\" field; for task extract also include \"extracted\" with concise preference keys.\nTask: ${request.task}\nUser message: ${request.message ?? 'none'}\nContext: ${JSON.stringify(request.context ?? {})}`
  const result = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? 'gpt-5-mini',
    input: prompt,
  })
  try {
    return { ...(JSON.parse(result.output_text) as object), source: 'openai' as const }
  } catch {
    return { summary: result.output_text || fallback(request).summary, source: 'openai' as const }
  }
}
