import { Router } from 'express'
import { create, list, update } from '../services/apiStore.js'
import { assertQuestMember, HttpError, requireUser } from '../services/access.js'
import { selectRows } from '../storage.js'
import { payload, routeParam } from './helpers.js'
import { text } from '../services/travelPreferences.js'
import { validatePreferencePayload } from '../services/preferenceValidation.js'

export const preferencesRouter = Router({ mergeParams: true })
preferencesRouter.use(requireUser, (request, response, next) => {
  if (routeParam(request, 'userId') !== response.locals.userId) throw new HttpError(403, 'You can only change your own preferences.')
  next()
})
preferencesRouter.post('/', async (request, response) => {
  const data = validatePreferencePayload(payload(request))
  if (data.tripRoomId) await assertQuestMember(text(data.tripRoomId, 150), response.locals.userId)
  response.status(201).json({ data: await create('preferences', 'preference', { ...data, userId: response.locals.userId }) })
})
preferencesRouter.patch('/:preferenceId', async (request, response) => {
  const [owned] = await selectRows<{ id: string; trip_room_id: string | null }>('preferences', ['id', 'trip_room_id'], [{ column: 'id', operator: 'eq', value: request.params.preferenceId }, { column: 'user_id', operator: 'eq', value: response.locals.userId }])
  if (!owned) throw new HttpError(404, 'Preference not found.')
  if (owned.trip_room_id) await assertQuestMember(owned.trip_room_id, response.locals.userId)
  const data = validatePreferencePayload(payload(request))
  if (data.tripRoomId !== undefined && data.tripRoomId !== owned.trip_room_id) throw new HttpError(400, 'Preferences cannot be moved to a different quest.')
  response.json({ data: await update('preferences', owned.id, data) })
})
preferencesRouter.get('/', async (_request, response) => response.json({ data: await list('preferences', 'userId', response.locals.userId) }))
