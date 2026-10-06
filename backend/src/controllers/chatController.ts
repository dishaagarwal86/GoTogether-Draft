import type { Request, Response } from 'express'
import { userForToken } from '../services/authService.js'
import { createQuestMessage, listQuestMessages } from '../services/chatService.js'

const bearer = (header?: string) => header?.startsWith('Bearer ') ? header.slice(7) : ''
const roomId = (request: Request) => Array.isArray(request.params.roomId) ? request.params.roomId[0] : request.params.roomId

async function authenticatedUser(request: Request, response: Response) {
  const user = await userForToken(bearer(request.header('authorization')))
  if (user) return user
  response.status(401).json({ error: 'Please sign in to use quest chat.' })
  return undefined
}

export async function getQuestMessages(request: Request, response: Response) {
  const user = await authenticatedUser(request, response)
  if (!user) return
  try {
    response.json({ data: await listQuestMessages(roomId(request) ?? '', user.id) })
  } catch (error) {
    response.status(403).json({ error: error instanceof Error ? error.message : 'Could not load quest chat.' })
  }
}

export async function postQuestMessage(request: Request, response: Response) {
  const user = await authenticatedUser(request, response)
  if (!user) return
  const body = typeof request.body?.body === 'string' ? request.body.body : ''
  try {
    response.status(201).json({ data: await createQuestMessage(roomId(request) ?? '', user.id, body) })
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Could not send this message.' })
  }
}
