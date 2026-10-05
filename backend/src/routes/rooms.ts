import { Router } from 'express'
import { getRooms, patchRoom, postRoom } from '../controllers/roomController.js'

export const roomsRouter = Router()
roomsRouter.get('/', getRooms)
roomsRouter.post('/', postRoom)
roomsRouter.patch('/:roomId', patchRoom)
