import { Router } from 'express'
import { create, list, update } from '../services/apiStore.js'
import { notFound, payload, routeParam } from './helpers.js'

export const preferencesRouter = Router({ mergeParams: true })

preferencesRouter.post('/', async (request, response) => response.status(201).json({ data: await create('preferences', 'preference', { userId: routeParam(request, 'userId'), ...payload(request) }) }))
preferencesRouter.patch('/:preferenceId', async (request, response) => {
  const preference = await update('preferences', request.params.preferenceId, payload(request))
  if (!preference) return notFound(response, 'Preference')
  response.json({ data: preference })
})
preferencesRouter.get('/', async (request, response) => response.json({ data: await list('preferences', 'userId', routeParam(request, 'userId')) }))
