import { Router } from 'express'
import { create, find, remove, update } from '../services/apiStore.js'
import { notFound, payload, requireFields } from './helpers.js'

export const usersRouter = Router()

usersRouter.post('/', async (request, response) => {
  const input = payload(request)
  if (!requireFields(response, input, ['name', 'email'])) return
  response.status(201).json({ data: await create('users', 'user', input) })
})
usersRouter.get('/:userId', async (request, response) => {
  const user = await find('users', request.params.userId)
  if (!user) return notFound(response, 'User')
  response.json({ data: user })
})
usersRouter.patch('/:userId', async (request, response) => {
  const user = await update('users', request.params.userId, payload(request))
  if (!user) return notFound(response, 'User')
  response.json({ data: user })
})
usersRouter.delete('/:userId', async (request, response) => {
  if (!await remove('users', request.params.userId)) return notFound(response, 'User')
  response.status(204).send()
})
