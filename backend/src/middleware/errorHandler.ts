import type { ErrorRequestHandler } from 'express'
import { HttpError } from '../services/access.js'

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) {
    if (error.status === 429) response.setHeader('Retry-After', '60')
    response.status(error.status).json({ error: error.message }); return
  }
  console.error(error)
  response.status(500).json({ error: 'An unexpected server error occurred.' })
}
