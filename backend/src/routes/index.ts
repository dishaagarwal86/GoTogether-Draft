import { Router } from 'express'
import { roomsRouter } from './rooms.js'
import { contactsRouter } from './contacts.js'
import { itinerariesRouter, userItinerariesRouter } from './itineraries.js'
import { preferencesRouter } from './preferences.js'
import { travelServicesRouter, userTravelRouter } from './travelServices.js'
import { usersRouter } from './users.js'
import { authRouter } from './auth.js'
import { companionRouter } from './companion.js'

export const apiRouter = Router()
apiRouter.get('/health', (_request, response) => response.json({ status: 'ok' }))
apiRouter.use('/auth', authRouter)
apiRouter.use('/companion', companionRouter)
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
