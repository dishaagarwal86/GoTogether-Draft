import { Router } from 'express'
import { create, list, remove } from '../services/apiStore.js'
import { notFound, payload, requireFields, routeParam } from './helpers.js'

export const contactsRouter = Router({ mergeParams: true })

contactsRouter.get('/', async (request, response) => response.json({ data: await list('contacts', 'userId', routeParam(request, 'userId')) }))
contactsRouter.post('/', async (request, response) => {
  const input = payload(request)
  if (!requireFields(response, input, ['name', 'email'])) return
  response.status(201).json({ data: await create('contacts', 'contact', { userId: routeParam(request, 'userId'), ...input }) })
})
contactsRouter.delete('/:contactId', async (request, response) => {
  if (!await remove('contacts', request.params.contactId)) return notFound(response, 'Contact')
  response.status(204).send()
})
