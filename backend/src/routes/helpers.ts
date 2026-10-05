import type { Request, Response } from 'express'

export function payload(request: Request): Record<string, unknown> {
  return request.body && typeof request.body === 'object' && !Array.isArray(request.body) ? request.body as Record<string, unknown> : {}
}

export function requireFields(response: Response, input: Record<string, unknown>, fields: string[]) {
  const missing = fields.filter((field) => typeof input[field] !== 'string' || !(input[field] as string).trim())
  if (!missing.length) return true
  response.status(400).json({ error: `Missing required fields: ${missing.join(', ')}.` })
  return false
}

export function notFound(response: Response, label: string) {
  response.status(404).json({ error: `${label} not found.` })
}

export function routeParam(request: Request, name: string) {
  const value = (request.params as Record<string, string | string[] | undefined>)[name]
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}
