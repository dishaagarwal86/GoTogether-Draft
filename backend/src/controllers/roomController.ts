import { HttpError } from '../services/access.js'
import type { Request, Response } from 'express'
import { createRoom, inviteToRoom, listRooms, updateRoom } from '../services/roomService.js'
import { rememberContact } from '../services/contactService.js'

export async function getRooms(_request: Request, response: Response) {
  response.json({ data: await listRooms() })
}

export async function postRoom(request: Request, response: Response) {
  const { name, tripName, members, inviteEmail, ownerId } = request.body as { name?: string; tripName?: string; members?: number; inviteEmail?: string; ownerId?: string }
  if (!name?.trim() || !tripName?.trim()) {
    response.status(400).json({ error: 'name and tripName are required.' })
    return
  }
  try {
    const room = await createRoom({ name, tripName, members, inviteEmail, ownerId })
    if (inviteEmail?.trim() && response.locals.userId) await rememberContact(response.locals.userId, { email: inviteEmail })
    response.status(201).json({ data: room })
  } catch (error) {
    if (error instanceof HttpError) return response.status(error.status).json({ error: error.message })
    const message = error instanceof Error ? error.message : ''
    if (/trip_room_invites|schema cache|relation .* does not exist/i.test(message)) {
      response.status(503).json({ error: 'Invitations need one database setup step. Run database/migrations/002_trip_room_invites.sql in your configured database, then try again.' })
      return
    }
    console.error('Could not create quest:', error)
    response.status(500).json({ error: 'Could not save your quest. Please try again.' })
  }
}

export async function postRoomInvite(request: Request, response: Response) {
  const roomId = Array.isArray(request.params.roomId) ? request.params.roomId[0] : request.params.roomId
  const email = typeof request.body?.email === 'string' ? request.body.email.trim() : ''
  if (!email) return response.status(400).json({ error: 'An invite email is required.' })
  try {
    const invite = await inviteToRoom(roomId ?? '', email)
    if (!invite) return response.status(404).json({ error: 'Quest not found.' })
    await rememberContact(response.locals.userId, { name: typeof request.body?.name === 'string' ? request.body.name : undefined, email })
    return response.status(201).json({ data: invite })
  } catch (error) {
    if (error instanceof HttpError) return response.status(error.status).json({ error: error.message })
    const message = error instanceof Error ? error.message : ''
    if (/trip_room_invites|schema cache|relation .* does not exist/i.test(message)) {
      return response.status(503).json({ error: 'Invitations need one database setup step. Run database/migrations/002_trip_room_invites.sql in your configured database.' })
    }
    console.error('Could not invite to quest:', error)
    return response.status(500).json({ error: 'Could not send this invitation. Please try again.' })
  }
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
