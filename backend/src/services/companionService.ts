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

type AiProvider = 'openai' | 'ollama'

function configuredProvider(): AiProvider | undefined {
  const requested = process.env.AI_PROVIDER?.toLowerCase()
  if (requested === 'ollama' || requested === 'openai') return requested
  if (process.env.OLLAMA_API_KEY) return 'ollama'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return undefined
}

export async function askCompanion(request: CompanionRequest) {
  const provider = configuredProvider()
  if (!provider) return { ...fallback(request), source: 'fallback' as const }

  const isOllama = provider === 'ollama'
  const apiKey = isOllama ? process.env.OLLAMA_API_KEY : process.env.OPENAI_API_KEY
  if (!apiKey) return { ...fallback(request), source: 'fallback' as const }
  const client = new OpenAI({
    apiKey,
    ...(isOllama ? { baseURL: process.env.OLLAMA_BASE_URL ?? 'https://ollama.com/v1' } : {}),
  })
  const prompt = `You are the GoTogether Companion for group travel. Be warm, concise and practical. Never claim to calculate scores or make bookings. Return valid JSON only with a single \"summary\" field; for task extract also include \"extracted\" with concise preference keys.\nTask: ${request.task}\nUser message: ${request.message ?? 'none'}\nContext: ${JSON.stringify(request.context ?? {})}`
  const result = await client.responses.create({
    model: isOllama ? (process.env.OLLAMA_MODEL ?? 'gpt-oss:20b') : (process.env.OPENAI_MODEL ?? 'gpt-5-mini'),
    input: prompt,
  })
  try {
    return { ...(JSON.parse(result.output_text) as object), source: provider }
  } catch {
    return { summary: result.output_text || fallback(request).summary, source: provider }
  }
}
