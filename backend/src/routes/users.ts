import { Router, type Request, type Response } from 'express'
import { find, remove, update } from '../services/apiStore.js'
import { notFound, payload, routeParam } from './helpers.js'
import { listUserRooms } from '../services/roomService.js'
import { HttpError, requireUser } from '../services/access.js'

export const usersRouter = Router()

usersRouter.post('/', (_request, response) => response.status(410).json({ error: 'Create an account through /api/auth/signup.' }))
usersRouter.use('/:userId', requireUser, (request, response, next) => {
  if (routeParam(request, 'userId') !== response.locals.userId) throw new HttpError(403, 'This account belongs to another traveller.')
  next()
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
