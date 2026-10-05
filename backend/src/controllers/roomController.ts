import type { Request, Response } from 'express'
import { createRoom, listRooms, updateRoom } from '../services/roomService.js'

export async function getRooms(_request: Request, response: Response) {
  response.json({ data: await listRooms() })
}

export async function postRoom(request: Request, response: Response) {
  const { name, tripName, members } = request.body as { name?: string; tripName?: string; members?: number }
  if (!name?.trim() || !tripName?.trim()) {
    response.status(400).json({ error: 'name and tripName are required.' })
    return
  }
  response.status(201).json({ data: await createRoom({ name, tripName, members }) })
}

export async function patchRoom(request: Request, response: Response) {
  const { name, tripName, members } = request.body as { name?: string; tripName?: string; members?: number }
  const roomId = Array.isArray(request.params.roomId) ? request.params.roomId[0] : request.params.roomId
  const room = await updateRoom(roomId ?? '', { name, tripName, members })
  if (!room) {
    response.status(404).json({ error: 'Trip room not found.' })
    return
  }
  response.json({ data: room })
}
