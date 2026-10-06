import { Router } from 'express'
import { getRooms, patchRoom, postRoom, postRoomInvite } from '../controllers/roomController.js'
import { getQuestMessages, postQuestMessage } from '../controllers/chatController.js'

export const roomsRouter = Router()
roomsRouter.get('/', getRooms)
roomsRouter.post('/', postRoom)
roomsRouter.post('/:roomId/invites', postRoomInvite)
roomsRouter.get('/:roomId/messages', getQuestMessages)
roomsRouter.post('/:roomId/messages', postQuestMessage)
roomsRouter.patch('/:roomId', patchRoom)
