import cors from 'cors'
import express from 'express'
import { errorHandler } from './middleware/errorHandler.js'
import { apiRouter } from './routes/index.js'

export const app = express()

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://127.0.0.1:5173' }))
app.use(express.json())
app.use('/api', apiRouter)
app.use(errorHandler)
