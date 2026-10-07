import { Router } from 'express'
import { requireUser } from '../services/access.js'
import { confirmPastTrip, draftPastTrip, getPastTrip, getTravelProfile, rememberEdit, requestId, savePastTripDraft, travelAction, updateTravelSettings, validateMemory } from '../services/travelMemory.js'
import { payload, routeParam } from './helpers.js'

export const travelMemoryRouter = Router()
travelMemoryRouter.use(requireUser)
travelMemoryRouter.get('/', async (_request, response) => response.json({ data: await getTravelProfile(response.locals.userId) }))
travelMemoryRouter.patch('/settings', async (request, response) => response.json({ data: await updateTravelSettings(response.locals.userId, payload(request)) }))
travelMemoryRouter.post('/remember', async (request, response) => response.json({ data: await rememberEdit(response.locals.userId, payload(request)) }))
travelMemoryRouter.post('/memories', async (request, response) => response.json({ data: await travelAction(response.locals.userId, 'memory', validateMemory(payload(request))) }))
travelMemoryRouter.delete('/memories/:memoryId', async (request, response) => response.json({ data: await travelAction(response.locals.userId, 'forget', { id: routeParam(request, 'memoryId') }) }))
travelMemoryRouter.delete('/memories', async (_request, response) => response.json({ data: await travelAction(response.locals.userId, 'reset') }))
travelMemoryRouter.post('/imports', async (request, response) => response.status(201).json({ data: await draftPastTrip(response.locals.userId, payload(request)) }))
travelMemoryRouter.get('/imports/:importId', async (request, response) => response.json({ data: await getPastTrip(response.locals.userId, routeParam(request, 'importId')) }))
travelMemoryRouter.patch('/imports/:importId', async (request, response) => response.json({ data: await savePastTripDraft(response.locals.userId, routeParam(request, 'importId'), payload(request)) }))
travelMemoryRouter.post('/imports/:importId/confirm', async (request, response) => response.json({ data: await confirmPastTrip(response.locals.userId, routeParam(request, 'importId'), payload(request)) }))
travelMemoryRouter.delete('/imports/:importId', async (request, response) => response.json({ data: await travelAction(response.locals.userId, 'import_delete', { id: routeParam(request, 'importId') }) }))
travelMemoryRouter.post('/redemptions', async (request, response) => response.json({ data: await travelAction(response.locals.userId, 'redeem', { requestId: requestId(payload(request).requestId) }) }))
