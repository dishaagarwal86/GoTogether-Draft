import { Router } from 'express'
import { demoEnabled } from '../demo/config.js'
import { demoSession, describeDemo } from '../demo/service.js'

export const demoRouter = Router()
demoRouter.use((request, response, next) => {
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '')
  if (!demoEnabled() || !local) { response.status(404).json({ error: 'Not found' }); return }
  response.setHeader('Cache-Control', 'no-store')
  next()
})
demoRouter.get('/', async (_request, response) => response.json({ data: await describeDemo() }))
demoRouter.post('/session', async (request, response) => response.json({ data: await demoSession(request.body?.actorKey) }))
