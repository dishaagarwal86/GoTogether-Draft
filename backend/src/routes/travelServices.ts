import { Router } from 'express'
import { create, find, list, remove, update } from '../services/apiStore.js'
import { notFound, payload, routeParam } from './helpers.js'
import { HttpError } from '../services/access.js'
import { selectRows } from '../storage.js'

export const travelServicesRouter = Router()
export const userTravelRouter = Router({ mergeParams: true })

travelServicesRouter.get('/flights/:flightId', async (request, response) => {
  const flight = await find('flights', request.params.flightId)
  if (!flight) return notFound(response, 'Flight')
  response.json({ data: flight })
})
travelServicesRouter.get('/hotels/:hotelId', async (request, response) => {
  const hotel = await find('hotels', request.params.hotelId)
  if (!hotel) return notFound(response, 'Hotel')
  response.json({ data: hotel })
})
travelServicesRouter.get('/activities', async (_request, response) => response.json({ data: await list('activities') }))

userTravelRouter.post('/itineraries/:itineraryId/flights', async (request, response) => response.status(201).json({ data: await create('flights', 'flight', { userId: routeParam(request, 'userId'), itineraryId: routeParam(request, 'itineraryId'), ...payload(request) }) }))
userTravelRouter.patch('/flights/:flightId', async (request, response) => updateResponse(response, 'flights', request.params.flightId, payload(request), 'Flight'))
userTravelRouter.post('/itineraries/:itineraryId/hotels', async (request, response) => response.status(201).json({ data: await create('hotels', 'hotel', { userId: routeParam(request, 'userId'), itineraryId: routeParam(request, 'itineraryId'), ...payload(request) }) }))
userTravelRouter.patch('/hotels/:hotelId', async (request, response) => updateResponse(response, 'hotels', request.params.hotelId, payload(request), 'Hotel'))
userTravelRouter.post('/itineraries/:itineraryId/activities', async (request, response) => response.status(201).json({ data: await create('activities', 'activity', { userId: routeParam(request, 'userId'), itineraryId: routeParam(request, 'itineraryId'), ...payload(request) }) }))
userTravelRouter.patch('/activities/:activityId', async (request, response) => updateResponse(response, 'activities', request.params.activityId, payload(request), 'Activity'))
userTravelRouter.delete('/activities/:activityId', async (request, response) => {
  if (!await remove('activities', request.params.activityId)) return notFound(response, 'Activity')
  response.status(204).send()
})
userTravelRouter.post('/suggested-itineraries', async (request, response) => response.status(201).json({ data: await create('suggestedItineraries', 'suggestion', { ...payload(request), userId: response.locals.userId }) }))
userTravelRouter.patch('/suggested-itineraries/:suggestionId', async (request, response) => {
  const id = routeParam(request, 'suggestionId')
  // Generated options, idea caches and activity confirmations share this table
  // but may only change through their validated planning services.
  if (!id.startsWith('suggestion_')) throw new HttpError(403, 'This planning record is managed by the quest.')
  const [owned] = await selectRows('suggested_itineraries', ['id'], [{ column: 'id', operator: 'eq', value: id }, { column: 'user_id', operator: 'eq', value: response.locals.userId }])
  if (!owned) return notFound(response, 'Suggested itinerary')
  return updateResponse(response, 'suggestedItineraries', id, { ...payload(request), userId: response.locals.userId }, 'Suggested itinerary')
})

async function updateResponse(response: import('express').Response, collection: 'flights' | 'hotels' | 'activities' | 'suggestedItineraries', id: string, input: Record<string, unknown>, label: string) {
  const item = await update(collection, id, input)
  if (!item) return notFound(response, label)
  response.json({ data: item })
}
