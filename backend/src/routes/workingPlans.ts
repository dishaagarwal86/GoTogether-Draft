import { Router } from 'express'
import { requireUser } from '../services/access.js'
import { changeWorkingPlan, getWorkingPlan, startWorkingPlan } from '../services/workingPlan.js'
import { payload, routeParam } from './helpers.js'

export const workingPlansRouter = Router()
workingPlansRouter.use(requireUser)
workingPlansRouter.get('/:roomId', async (request, response) => response.json({ data: await getWorkingPlan(routeParam(request, 'roomId'), response.locals.userId) }))
workingPlansRouter.post('/:roomId', async (request, response) => response.status(201).json({ data: await startWorkingPlan(routeParam(request, 'roomId'), response.locals.userId, payload(request).catalogueId) }))
workingPlansRouter.post('/:roomId/changes', async (request, response) => response.json({ data: await changeWorkingPlan(routeParam(request, 'roomId'), response.locals.userId, payload(request)) }))
