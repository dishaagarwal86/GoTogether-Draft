import { Router } from 'express'
import { getRooms, postRoom } from '../controllers/roomController.js'

export const roomsRouter = Router()
roomsRouter.get('/', getRooms)
roomsRouter.post('/', postRoom)
