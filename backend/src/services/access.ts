import type { RequestHandler } from 'express'
import { userForToken } from './authService.js'
import { selectRows } from '../storage.js'

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export const requireUser: RequestHandler = async (request, response, next) => {
  const header = request.header('authorization')
  const user = header?.startsWith('Bearer ') ? await userForToken(header.slice(7)) : undefined
  if (!user) throw new HttpError(401, 'Please sign in to continue.')
  response.locals.userId = user.id
  next()
}

export async function assertQuestMember(roomId: string, userId: string) {
  const [membership] = await selectRows('trip_room_people', ['id'], [
    { column: 'trip_room_id', operator: 'eq', value: roomId },
    { column: 'user_id', operator: 'eq', value: userId },
    { column: 'invite_status', operator: 'eq', value: 'accepted' },
  ])
  if (!membership) throw new HttpError(403, 'Only accepted quest members can access this quest.')
}
