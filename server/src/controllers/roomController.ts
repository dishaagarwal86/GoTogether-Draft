import type { Request, Response } from 'express'
import { createRoom, listRooms } from '../services/roomService.js'

export function getRooms(_request: Request, response: Response) {
  response.json({ data: listRooms() })
}

export function postRoom(request: Request, response: Response) {
  const { name, tripName, members } = request.body as { name?: string; tripName?: string; members?: number }
  if (!name?.trim() || !tripName?.trim()) {
    response.status(400).json({ error: 'name and tripName are required.' })
    return
  }
  response.status(201).json({ data: createRoom({ name, tripName, members }) })
}
