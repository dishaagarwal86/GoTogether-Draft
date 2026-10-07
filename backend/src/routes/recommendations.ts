import { Router } from 'express'
import { recommendForQuest } from '../services/recommendationService.js'
import { assertQuestMember, requireUser } from '../services/access.js'
export const recommendationsRouter = Router()
recommendationsRouter.get('/quests/:roomId', requireUser, async (request, response) => {
  const roomId = String(request.params.roomId)
  await assertQuestMember(roomId, response.locals.userId)
  const result = await recommendForQuest(roomId)
  response.json({ data: { ...result, travelDna: result.travelDna ? { ...result.travelDna, noGoActivities: [] } : null } })
})
