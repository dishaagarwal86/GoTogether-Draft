import { Router, type Request, type Response } from 'express'
import { create, find, remove, update } from '../services/apiStore.js'
import { notFound, payload, requireFields, routeParam } from './helpers.js'
import { listUserRooms } from '../services/roomService.js'

export const usersRouter = Router()

usersRouter.post('/', async (request: Request, response: Response) => {
  const input = payload(request)
  if (!requireFields(response, input, ['name', 'email'])) return
  response.status(201).json({ data: await create('users', 'user', input) })
})
usersRouter.get('/:userId/trip-rooms', async (request: Request, response: Response) => response.json({ data: await listUserRooms(routeParam(request, 'userId')) }))
usersRouter.get('/:userId', async (request: Request, response: Response) => {
  const user = await find('users', routeParam(request, 'userId'))
  if (!user) return notFound(response, 'User')
  response.json({ data: user })
})
usersRouter.patch('/:userId', async (request: Request, response: Response) => {
  const user = await update('users', routeParam(request, 'userId'), payload(request))
  if (!user) return notFound(response, 'User')
  response.json({ data: user })
})
usersRouter.delete('/:userId', async (request: Request, response: Response) => {
  if (!await remove('users', routeParam(request, 'userId'))) return notFound(response, 'User')
  response.status(204).send()
})
