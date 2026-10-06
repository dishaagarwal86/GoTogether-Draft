import { Router } from 'express'
import { acceptTripRoomInvite, getTripRoomInvite } from '../services/invitationService.js'
import { userForToken } from '../services/authService.js'

export const invitesRouter = Router()
const bearer = (header?: string) => header?.startsWith('Bearer ') ? header.slice(7) : ''

invitesRouter.get('/:token', async (request, response, next) => {
  try { const invite = await getTripRoomInvite(String(request.params.token)); if (!invite) return response.status(404).json({ error: 'This invitation is unavailable or has expired.' }); return response.json({ data: invite }) } catch (error) { return next(error) }
})
invitesRouter.post('/:token/accept', async (request, response, next) => {
  try { const user = await userForToken(bearer(request.header('authorization'))); if (!user) return response.status(401).json({ error: 'Please sign in to accept this invitation.' }); return response.json({ data: await acceptTripRoomInvite(String(request.params.token), user) }) } catch (error) { return next(error) }
})
