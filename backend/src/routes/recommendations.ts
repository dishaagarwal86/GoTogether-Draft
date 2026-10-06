import { Router } from 'express'
import { recommendForQuest } from '../services/recommendationService.js'
export const recommendationsRouter = Router()
recommendationsRouter.get('/quests/:roomId', async (request, response, next) => { try { response.json({ data: await recommendForQuest(String(request.params.roomId)) }) } catch (error) { next(error) } })
