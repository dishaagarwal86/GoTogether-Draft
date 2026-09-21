import { Router } from 'express'
import { roomsRouter } from './rooms.js'

export const apiRouter = Router()
apiRouter.get('/health', (_request, response) => response.json({ status: 'ok' }))
apiRouter.use('/rooms', roomsRouter)
