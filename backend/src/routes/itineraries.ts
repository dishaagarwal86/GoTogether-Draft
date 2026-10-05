import { Router } from 'express'
import { countryItineraries, create, list, update } from '../services/apiStore.js'
import { notFound, payload, routeParam } from './helpers.js'

export const itinerariesRouter = Router()
export const userItinerariesRouter = Router({ mergeParams: true })

itinerariesRouter.get('/countries/:country', async (request, response) => response.json({ data: await countryItineraries(routeParam(request, 'country')) }))
userItinerariesRouter.get('/', async (request, response) => response.json({ data: await list('itineraries', 'userId', routeParam(request, 'userId')) }))
userItinerariesRouter.post('/', async (request, response) => response.status(201).json({ data: await create('itineraries', 'itinerary', { userId: routeParam(request, 'userId'), ...payload(request) }) }))
userItinerariesRouter.patch('/:itineraryId', async (request, response) => {
  const itinerary = await update('itineraries', request.params.itineraryId, payload(request))
  if (!itinerary) return notFound(response, 'Itinerary')
  response.json({ data: itinerary })
})
