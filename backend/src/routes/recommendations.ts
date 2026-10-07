import { Router } from 'express'
import { recommendForQuest } from '../services/recommendationService.js'
import { assertQuestMember, requireUser } from '../services/access.js'
export const recommendationsRouter = Router()
recommendationsRouter.get('/quests/:roomId', requireUser, async (request, response) => {
  const roomId = String(request.params.roomId)
  await assertQuestMember(roomId, response.locals.userId)
  response.json({ data: await recommendForQuest(roomId) })
})
