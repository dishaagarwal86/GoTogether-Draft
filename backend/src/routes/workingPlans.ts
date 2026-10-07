import { Router } from 'express'
import { requireUser } from '../services/access.js'
import { assertPlanEditor, changeWorkingPlan, getWorkingPlan, startWorkingPlan } from '../services/workingPlan.js'
import { payload, routeParam } from './helpers.js'
import { listPlanProposals, proposePlanChange } from '../services/planProposals.js'
import { travelAction } from '../services/travelMemory.js'

export const workingPlansRouter = Router()
workingPlansRouter.use(requireUser)
workingPlansRouter.get('/:roomId', async (request, response) => response.json({ data: await getWorkingPlan(routeParam(request, 'roomId'), response.locals.userId) }))
workingPlansRouter.post('/:roomId', async (request, response) => response.status(201).json({ data: await startWorkingPlan(routeParam(request, 'roomId'), response.locals.userId, payload(request).catalogueId) }))
workingPlansRouter.post('/:roomId/changes', async (request, response) => response.json({ data: await changeWorkingPlan(routeParam(request, 'roomId'), response.locals.userId, payload(request)) }))
workingPlansRouter.get('/:roomId/proposals', async (request, response) => response.json({ data: await listPlanProposals(response.locals.userId, routeParam(request, 'roomId')) }))
workingPlansRouter.post('/:roomId/proposals', async (request, response) => response.json({ data: await proposePlanChange(response.locals.userId, routeParam(request, 'roomId'), payload(request)) }))
workingPlansRouter.post('/:roomId/proposals/:proposalId/dismiss', async (request, response) => { await assertPlanEditor(routeParam(request, 'roomId'), response.locals.userId); response.json({ data: await travelAction(response.locals.userId, 'dismiss', { id: routeParam(request, 'proposalId'), roomId: routeParam(request, 'roomId') }) }) })
