import { Router } from 'express'
import { requireUser } from '../services/access.js'
import { personalise, savedStory } from '../services/personalisationService.js'

export const personaliseItineraryRouter = Router()
personaliseItineraryRouter.use(requireUser)
personaliseItineraryRouter.get('/', async (request, response) => response.json({ data: await savedStory(response.locals.userId, request.query) }))
personaliseItineraryRouter.post('/', async (request, response) => response.json({ data: await personalise(response.locals.userId, request.body) }))
