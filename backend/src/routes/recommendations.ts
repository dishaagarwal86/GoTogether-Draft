import { Router } from 'express'
import { recommendForQuest, publicRecommendations } from '../services/recommendationService.js'
import { assertQuestMember, requireUser } from '../services/access.js'
export const recommendationsRouter = Router()
recommendationsRouter.get('/quests/:roomId', requireUser, async (request, response) => {
  const roomId = String(request.params.roomId)
  await assertQuestMember(roomId, response.locals.userId)
  const result = await recommendForQuest(roomId)
  response.json({ data: publicRecommendations(result, response.locals.userId) })
})
