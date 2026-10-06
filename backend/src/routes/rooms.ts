import { Router } from 'express'
import { getRooms, patchRoom, postRoom, postRoomInvite } from '../controllers/roomController.js'
import { getQuestMessages, postQuestMessage } from '../controllers/chatController.js'
import { analyseNotes, applyNote, dismissNote, getQuestNotes, patchQuestNotes } from '../controllers/questNotesController.js'
import { getShortlistController, postPickController, postReactionController, postSharePickController } from '../controllers/shortlistController.js'

export const roomsRouter = Router()
roomsRouter.get('/', getRooms)
roomsRouter.post('/', postRoom)
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
