import { Router } from 'express'
import { applySuggestion, askCompanion } from '../services/companionService.js'
import { requireUser, HttpError } from '../services/access.js'
import { aiHistory, type AiTask } from '../services/aiHistory.js'
import { recommendForQuest } from '../services/recommendationService.js'

export const companionRouter = Router()

companionRouter.use(requireUser)
companionRouter.post('/', async (request, response) => {
  response.json(await askCompanion(response.locals.userId, request.body))
})
companionRouter.get('/history', async (request, response) => {
  const roomId = typeof request.query.roomId === 'string' ? request.query.roomId : undefined
  const task = typeof request.query.task === 'string' ? request.query.task as AiTask : undefined
  if (task && !['extract', 'group-dna', 'explain', 'chat'].includes(task)) throw new HttpError(400, 'Invalid Companion history task.')
  const items = await aiHistory(response.locals.userId, roomId, task)
  const plan = task === 'explain' && roomId ? await recommendForQuest(roomId) : undefined
  response.json({ data: items.filter(item => !plan || item.data.planVersion === plan.preferenceVersion).map(item => ({ id: item.id, task: item.task, createdAt: item.created_at, ...item.data })) })
})
companionRouter.post('/:recordId/apply', async (request, response) => {
  response.json({ data: await applySuggestion(response.locals.userId, String(request.params.recordId), request.body?.fields) })
})
