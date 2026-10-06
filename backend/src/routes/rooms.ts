import { Router } from 'express'
import { getRooms, patchRoom, postRoom, postRoomInvite } from '../controllers/roomController.js'

export const roomsRouter = Router()
roomsRouter.get('/', getRooms)
roomsRouter.post('/', postRoom)
roomsRouter.post('/:roomId/invites', postRoomInvite)
roomsRouter.patch('/:roomId', patchRoom)
