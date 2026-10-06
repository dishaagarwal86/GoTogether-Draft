import cors from 'cors'
import express from 'express'
import { errorHandler } from './middleware/errorHandler.js'
import { apiRouter } from './routes/index.js'

export const app = express()

const frontendOrigins = new Set([
  'http://localhost:5173',
  ...(process.env.FRONTEND_URL ?? '').split(',').map((value) => value.trim()).filter(Boolean),
])

app.use(cors({
  origin(origin, callback) {
    // Server-to-server requests and health checks do not send an Origin header.
    if (!origin || frontendOrigins.has(origin)) return callback(null, true)
    return callback(new Error('Origin is not allowed by CORS.'))
  },
}))
app.use(express.json())
app.get('/health', (_request, response) => response.json({ status: 'ok' }))
app.use('/api', apiRouter)
app.use(errorHandler)
