import { Router } from 'express'
import { askCompanion } from '../services/companionService.js'

export const companionRouter = Router()

companionRouter.post('/', async (request, response, next) => {
  try {
    const { task, message, context } = request.body ?? {}
    if (!['extract', 'group-dna', 'explain'].includes(task)) return response.status(400).json({ error: 'A valid companion task is required.' })
    return response.json(await askCompanion({ task, message, context }))
  } catch (error) { return next(error) }
})
