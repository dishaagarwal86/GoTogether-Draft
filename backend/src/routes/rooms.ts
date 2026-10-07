import { Router } from 'express'
import { patchRoom, postRoom, postRoomInvite } from '../controllers/roomController.js'
import { getQuestMessages, postQuestMessage } from '../controllers/chatController.js'
import { analyseNotes, applyNote, dismissNote, getQuestNotes, patchQuestNotes } from '../controllers/questNotesController.js'
import { getShortlistController, postPickController, postReactionController, postSharePickController } from '../controllers/shortlistController.js'
import { assertQuestMember, requireUser } from '../services/access.js'
import { assertPlanEditor } from '../services/workingPlan.js'
import { listUserRooms } from '../services/roomService.js'
import { routeParam } from './helpers.js'

export const roomsRouter = Router()
roomsRouter.use(requireUser)
roomsRouter.get('/', async (_request, response) => response.json({ data: await listUserRooms(response.locals.userId) }))
roomsRouter.post('/', (request, response, next) => { request.body = { ...request.body, ownerId: response.locals.userId }; next() }, postRoom)
roomsRouter.use('/:roomId', async (request, response, next) => {
  const roomId = routeParam(request, 'roomId')
  await assertQuestMember(roomId, response.locals.userId)
  if (request.method === 'PATCH' && request.path === '/' || request.method === 'POST' && request.path === '/invites') await assertPlanEditor(roomId, response.locals.userId)
  next()
})
roomsRouter.post('/:roomId/invites', postRoomInvite)
roomsRouter.get('/:roomId/messages', getQuestMessages)
roomsRouter.post('/:roomId/messages', postQuestMessage)
roomsRouter.get('/:roomId/quest-notes', getQuestNotes)
roomsRouter.patch('/:roomId/quest-notes', patchQuestNotes)
roomsRouter.post('/:roomId/quest-notes/analyse', analyseNotes)
roomsRouter.post('/:roomId/quest-notes/:noteId/apply', applyNote)
roomsRouter.post('/:roomId/quest-notes/:noteId/dismiss', dismissNote)
roomsRouter.get('/:roomId/shortlist', getShortlistController)
roomsRouter.post('/:roomId/picks', postPickController)
roomsRouter.post('/:roomId/picks/:pickId/share', postSharePickController)
roomsRouter.post('/:roomId/shared-picks/:sharedPickId/reaction', postReactionController)
roomsRouter.patch('/:roomId', patchRoom)
