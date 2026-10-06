import { Router } from 'express'
import { endSession, loginUser, registerUser, userForToken, updateUserProfile } from '../services/authService.js'
import { payload } from './helpers.js'

export const authRouter = Router()
const token = (header?: string) => header?.startsWith('Bearer ') ? header.slice(7) : ''

authRouter.post('/signup', async (request, response) => {
  const input = payload(request)
  const firstName = typeof input.firstName === 'string' ? input.firstName.trim() : ''
  const lastName = typeof input.lastName === 'string' ? input.lastName.trim() : ''
  const email = typeof input.email === 'string' ? input.email.trim() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  if (!firstName || !lastName || !email || password.length < 8) return response.status(400).json({ error: 'Enter your name, email, and a password of at least 8 characters.' })
  try { response.status(201).json({ data: await registerUser({ firstName, lastName, email, password, country: typeof input.country === 'string' ? input.country : undefined }) }) }
  catch (error) { response.status(409).json({ error: error instanceof Error ? error.message : 'Could not create account.' }) }
})
authRouter.post('/login', async (request, response) => {
  const input = payload(request)
  try { response.json({ data: await loginUser(String(input.email ?? ''), String(input.password ?? '')) }) }
  catch (error) { response.status(401).json({ error: error instanceof Error ? error.message : 'Could not sign in.' }) }
})
authRouter.get('/me', async (request, response) => { const user = await userForToken(token(request.header('authorization'))); if (!user) return response.status(401).json({ error: 'Please sign in.' }); response.json({ data: user }) })
authRouter.post('/logout', async (request, response) => { const value = token(request.header('authorization')); if (value) await endSession(value); response.status(204).send() })

authRouter.patch('/me', async (request, response) => {
  const user = await userForToken(token(request.header('authorization')))
  if (!user) return response.status(401).json({ error: 'Please sign in again to update your profile.' })
  const input = payload(request)
  const firstName = typeof input.firstName === 'string' ? input.firstName.trim() : ''
  const lastName = typeof input.lastName === 'string' ? input.lastName.trim() : ''
  const country = typeof input.country === 'string' ? input.country.trim() : ''
  if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60 || country.length > 100) return response.status(400).json({ error: 'Enter a first and last name of up to 60 characters.' })
  response.json({ data: await updateUserProfile(user.id, { firstName, lastName, country }) })
})
