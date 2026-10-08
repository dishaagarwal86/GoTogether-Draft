import { Router } from 'express'
import OpenAI from 'openai'
import { countryItineraries, create, list, update } from '../services/apiStore.js'
import { notFound, payload, routeParam } from './helpers.js'
import { selectRows } from '../storage.js'
import { assertQuestMember, requireUser } from '../services/access.js'
import { reserveAiRequest } from '../services/aiHistory.js'
import { questParticipants, sharedAvailability } from '../services/questParticipants.js'
import { record, text } from '../services/travelPreferences.js'
import { searchRealPlaces } from '../services/realPlaceService.js'

export const itinerariesRouter = Router()
export const userItinerariesRouter = Router({ mergeParams: true })

// Public editorial content only; this endpoint never reads traveller data or AI.
itinerariesRouter.get('/places', (request, response) => {
  const destination = typeof request.query.destination === 'string' ? request.query.destination.trim().slice(0, 100) : ''
  const country = typeof request.query.country === 'string' ? request.query.country.trim().slice(0, 60) : ''
  response.set('Cache-Control', 'public, max-age=3600').json({ data: { places: searchRealPlaces(destination, country) } })
})

itinerariesRouter.get('/catalogue', async (_request, response, next) => {
  try {
    const data = await selectRows('itinerary_catalogue', ['id', 'title', 'destination', 'country', 'duration_days', 'budget', 'estimated_cost_usd', 'seasons', 'moods', 'location_type', 'short_description', 'why_it_fits', 'daily_plan'], [], { orderBy: 'estimated_cost_usd', ascending: true })
    response.json({ data })
  } catch (error) { next(error) }
})

type RoomPref = { budget: string | null; days_count: number | null; location_preferences: { scope?: string; destination?: string; departureCity?: string } | null; mood_preferences: string[] | null; activities_must_have: string | null; data: { noGo?: string } | null }
function mergeRoomPreferences(members: RoomPref[]): Record<string, unknown> {
  const budgetOrder = ['Budget-friendly', 'Moderate', 'Premium', 'Flexible']
  const budgets = members.map((m) => m.budget).filter(Boolean) as string[]
  const lowestBudgetIdx = budgets.length ? Math.min(...budgets.map((b) => budgetOrder.indexOf(b)).filter((i) => i >= 0)) : -1
  const destinations = members.map((m) => m.location_preferences?.destination?.trim()).filter(Boolean) as string[]
  const allMoods = [...new Set(members.flatMap((m) => m.mood_preferences ?? []))]
  const durations = members.map((m) => m.days_count).filter(Boolean) as number[]
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null
  const mustHaves = members.map((m) => m.activities_must_have).filter(Boolean).join('; ')
  const noGos = members.map((m) => m.data?.noGo).filter(Boolean).join('; ')
  const departureCities = [...new Set(members.map((m) => m.location_preferences?.departureCity).filter(Boolean) as string[])]
  return { destination: destinations[0] ?? null, moods: allMoods, budget: lowestBudgetIdx >= 0 ? budgetOrder[lowestBudgetIdx] : null, tripLength: avgDuration ? (avgDuration <= 2 ? 'Weekend' : avgDuration <= 4 ? '3-4 days' : avgDuration <= 6 ? '5-7 days' : 'More than a week') : null, mustHave: mustHaves || null, noGo: noGos || null, memberCount: members.length, departureCities: departureCities.length ? departureCities : null }
}
itinerariesRouter.post('/ai-generate', requireUser, async (request, response, next) => {
  try {
    const { preferences, roomId } = record(request.body)
    if (JSON.stringify(request.body).length > 16000) return response.status(400).json({ error: 'These preferences are too long.' })
    let mergedPreferences = preferences
    if (roomId) {
      const id = text(roomId, 150)
      await assertQuestMember(id, response.locals.userId)
      const group = await questParticipants(id)
      if (!group.ready) return response.status(409).json({ error: 'Everyone must confirm their preferences before generating group itineraries.' })
      if (sharedAvailability(group.preferences).conflict) return response.status(409).json({ error: 'Your travel dates do not overlap. Agree on a shared window first.' })
      mergedPreferences = mergeRoomPreferences(group.preferences)

    }
    if (!mergedPreferences) return response.status(400).json({ error: 'Preferences are required.' })
    const isOllama = process.env.AI_PROVIDER === 'ollama'
    const apiKey = isOllama ? process.env.OLLAMA_API_KEY : process.env.OPENAI_API_KEY
    if (!apiKey) return response.status(503).json({ error: 'AI is not configured.' })
    record(mergedPreferences)
    await reserveAiRequest(response.locals.userId)
    const client = new OpenAI({ apiKey, timeout: 15000, maxRetries: 0, ...(isOllama ? { baseURL: process.env.OLLAMA_BASE_URL ?? 'https://ollama.com/v1' } : {}) })
    const schema = `{"title":"poetic title","destination":"city or region","country":"country name","duration":"N days","budget":"Budget-friendly|Moderate|Premium","seasons":["Spring|Summer|Autumn|Winter"],"moods":["Adventure|Food & Culture|Relaxation|Nature|Nightlife|Wellness"],"locationType":"Beach|Mountains|City|Countryside|Islands|Hidden gems","shortDescription":"one sentence","whyItFits":"one sentence why this matches the preferences","dailyPlan":[{"day":"Day 1","morning":"activity","afternoon":"activity","evening":"activity"}],"flights":[{"from":"departure city","airline":"example airline","type":"direct or 1 stop","estimatedCost":"cost range in local currency"}],"accommodation":{"type":"hotel/apartment/hostel/resort","name":"example property name","pricePerNight":"estimated cost range in local currency","notes":"one practical note"}}`
    const prefs = mergedPreferences as Record<string, unknown>
    const memberCount = Number(prefs.memberCount ?? 1)
    const destLine = prefs.destination ? `\n- DESTINATION (non-negotiable): All 3 itineraries must be in or near "${prefs.destination}".` : ''
    const groupLine = memberCount > 1 ? `\n\nThis is a GROUP trip for ${memberCount} travellers. Their preferences have been combined. The 3 itineraries should be:\n  1. Best shared match — the strongest fit for everyone\n  2. Fair compromise — satisfies the most critical needs of each traveller\n  3. Alternative experience — another direction within the same shared requirements\nThe whyItFits field should explain how the itinerary satisfies the group's combined preferences.` : ''
    const prompt = `You are GoTogether's AI travel planner. Generate exactly 3 unique travel itinerary suggestions.${groupLine}\n\nYour goal is to satisfy as many of the preferences as possible in each itinerary. Priority order:\n  1. Destination — always respect this if given, it cannot be dropped\n  2. Trip moods/feelings — try to satisfy all of them; gracefully reduce if needed\n  3. Budget — honour it where possible\n\nNever ignore a preference without a real reason. The whyItFits field must honestly explain which preferences are covered.\n\nRules:\n- Return a JSON array of exactly 3 objects. No markdown, no explanation — JSON only.\n- Each object must follow this schema exactly: ${schema}\n- budget must be one of: "Budget-friendly", "Moderate", "Premium"\n- locationType must be one of: "Beach", "Mountains", "City", "Countryside", "Islands", "Hidden gems"\n- moods must only use: "Adventure", "Food & Culture", "Relaxation", "Nature", "Nightlife", "Wellness"\n- seasons must only use: "Spring", "Summer", "Autumn", "Winter"\n- dailyPlan must have one entry per day matching the duration\n- Make each itinerary specific and distinct — different cities or experiences\n- flights: one entry per departure city in the preferences; use that city's local currency for estimatedCost\n- accommodation: match the budget level; use destination local currency for pricePerNight${destLine}\n\nPreferences: ${JSON.stringify(prefs)}`
    const result = await client.responses.create({ model: isOllama ? (process.env.OLLAMA_MODEL ?? 'gpt-oss:20b') : (process.env.OPENAI_MODEL ?? 'gpt-5-mini'), input: prompt, max_output_tokens: 6000 }, { signal: AbortSignal.timeout(18000) })
    const cleaned = result.output_text.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const itineraries = Array.isArray(parsed) ? parsed : (parsed.itineraries ?? [])
    response.json({ data: itineraries })
  } catch (error) { next(error) }
})

itinerariesRouter.get('/countries/:country', async (request, response) => response.json({ data: await countryItineraries(routeParam(request, 'country')) }))
userItinerariesRouter.get('/', async (request, response) => response.json({ data: await list('itineraries', 'userId', routeParam(request, 'userId')) }))
userItinerariesRouter.post('/', async (request, response) => response.status(201).json({ data: await create('itineraries', 'itinerary', { userId: routeParam(request, 'userId'), ...payload(request) }) }))
userItinerariesRouter.patch('/:itineraryId', async (request, response) => {
  const itinerary = await update('itineraries', request.params.itineraryId, payload(request))
  if (!itinerary) return notFound(response, 'Itinerary')
  response.json({ data: itinerary })
})
