import { Router } from 'express'
import OpenAI from 'openai'

export const personaliseItineraryRouter = Router()
const prompt = `You are GoTogether’s travel personalisation assistant. You personalise an already-selected curated itinerary for a group.

Rules:
- Do not change the destination, duration, budget band, season, or core activities.
- Do not invent confirmed prices, hotel availability, transport schedules, booking links, or real-time facts.
- Respect all group non-negotiables and no-go activities.
- Do not claim this is the only correct recommendation.
- Explain compromises fairly and positively.
- Use concise, warm travel-journal language.
- Return valid JSON only.`

personaliseItineraryRouter.post('/', async (request, response, next) => {
  try {
    const { groupTravelDNA, itinerary, deterministicReasoning } = request.body ?? {}
    if (!itinerary?.id || !Array.isArray(itinerary?.dayPlan)) return response.status(400).json({ error: 'A curated itinerary is required.' })
    const isOllama = process.env.AI_PROVIDER === 'ollama'; const apiKey = isOllama ? process.env.OLLAMA_API_KEY : process.env.OPENAI_API_KEY
    if (!apiKey) return response.status(503).json({ error: 'AI personalisation is not configured.' })
    const client = new OpenAI({ apiKey, ...(isOllama ? { baseURL: process.env.OLLAMA_BASE_URL ?? 'https://ollama.com/v1' } : {}) })
    const result = await client.responses.create({ model: isOllama ? (process.env.OLLAMA_MODEL ?? 'gpt-oss:20b') : (process.env.OPENAI_MODEL ?? 'gpt-5-mini'), input: `${prompt}\n\nGroup Travel DNA: ${JSON.stringify(groupTravelDNA)}\nCurated itinerary: ${JSON.stringify(itinerary)}\nDeterministic reasoning: ${JSON.stringify(deterministicReasoning)}\n\nReturn {"resultTitle":"","scrapbookIntro":"","whyItWorks":["","", ""],"tradeoffNote":"","days":[{"day":1,"title":"","description":"","highlights":["", ""],"mood":""}]}` })
    const parsed = JSON.parse(result.output_text)
    if (!parsed.resultTitle || !Array.isArray(parsed.days)) throw new Error('Invalid AI response')
    response.json({ data: parsed })
  } catch (error) { next(error) }
})
