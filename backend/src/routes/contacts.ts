import { Router } from 'express'
import { inviteContact, deleteContact, listContacts, rememberContact } from '../services/contactService.js'
import { payload, requireFields, routeParam } from './helpers.js'
import { HttpError, requireUser } from '../services/access.js'

export const contactsRouter = Router({ mergeParams: true })

contactsRouter.use(requireUser)
contactsRouter.use((request, response, next) => {
  if (routeParam(request, 'userId') !== response.locals.userId) return next(new HttpError(403, 'You can only manage your own contacts.'))
  next()
})
contactsRouter.get('/', async (_request, response) => response.json({ data: await listContacts(response.locals.userId) }))
contactsRouter.post('/', async (request, response) => {
  const input = payload(request)
  if (!requireFields(response, input, ['name', 'email'])) return
  response.status(201).json({ data: await rememberContact(response.locals.userId, { name: String(input.name), email: String(input.email) }) })
})
contactsRouter.post('/invite', async (request, response) => {
  const input = payload(request)
  if (!requireFields(response, input, ['email'])) return
  response.status(201).json({ data: await inviteContact(response.locals.userId, { name: typeof input.name === 'string' ? input.name : undefined, email: String(input.email) }) })
})
contactsRouter.delete('/:contactId', async (request, response) => {
  await deleteContact(response.locals.userId, request.params.contactId)
  response.status(204).send()
})
