import { Router } from 'express'
import { roomsRouter } from './rooms.js'
import { contactsRouter } from './contacts.js'
import { itinerariesRouter, userItinerariesRouter } from './itineraries.js'
import { preferencesRouter } from './preferences.js'
import { travelServicesRouter, userTravelRouter } from './travelServices.js'
import { usersRouter } from './users.js'
import { authRouter } from './auth.js'
import { companionRouter } from './companion.js'
import { invitesRouter } from './invites.js'
import { personaliseItineraryRouter } from './personaliseItinerary.js'
import { recommendationsRouter } from './recommendations.js'
import { workingPlansRouter } from './workingPlans.js'
import { travelMemoryRouter } from './travelMemory.js'
import { demoRouter } from './demo.js'

import { sharedInvitation, joinSharedRoom } from '../services/questJourney.js'
import { requireUser } from '../services/access.js'

export const apiRouter = Router()
apiRouter.use('/demo', demoRouter)
apiRouter.get('/health', (_request, response) => response.json({ status: 'ok' }))
apiRouter.get('/join-room/:token', async (request, response) => response.json({ data: await sharedInvitation(String(request.params.token)) }))
apiRouter.post('/join-room/:token', requireUser, async (request, response) => response.json({ data: await joinSharedRoom(String(request.params.token), response.locals.userId) }))
apiRouter.use('/auth', authRouter)
apiRouter.use('/companion', companionRouter)
apiRouter.use('/personalise-itinerary', personaliseItineraryRouter)
apiRouter.use('/recommendations', recommendationsRouter)
apiRouter.use('/working-plans', workingPlansRouter)
apiRouter.use('/me/travel-style', travelMemoryRouter)
apiRouter.use('/invites', invitesRouter)
// Users
apiRouter.use('/users', usersRouter)
// Trip rooms
apiRouter.use('/rooms', roomsRouter)
apiRouter.use('/trip-rooms', roomsRouter)
// User preferences and invites
apiRouter.use('/users/:userId/preferences', preferencesRouter)
apiRouter.use('/users/:userId/contacts', contactsRouter)
// Itineraries
apiRouter.use('/itineraries', itinerariesRouter)
apiRouter.use('/users/:userId/itineraries', userItinerariesRouter)
// Flights, hotels, activities, and suggested itineraries
apiRouter.use('/', travelServicesRouter)
apiRouter.use('/users/:userId', userTravelRouter)
