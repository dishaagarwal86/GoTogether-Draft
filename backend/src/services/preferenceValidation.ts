import { HttpError } from './access.js'
import { budgets, moodName, moods, paces, record, strings, text } from './travelPreferences.js'

// Only fields understood by the planner can enter the saved preference document.
export function validatePreferencePayload(value: unknown) {
  const input = record(value)
  if (JSON.stringify(input).length > 16000) throw new HttpError(400, 'These preferences are too long.')
  const output: Record<string, unknown> = {}
  for (const key of ['tripRoomId', 'budget', 'pace', 'activitiesMustHave', 'activitiesPreferred', 'noGo', 'discovery', 'companions']) {
    if (input[key] === undefined) continue
    if (input[key] === null) { output[key] = null; continue }
    if (typeof input[key] !== 'string' || input[key].length > 1000) throw new HttpError(400, `Invalid ${key}.`)
    output[key] = input[key].trim()
  }
  if (output.tripRoomId) output.tripRoomId = text(output.tripRoomId, 150)
  if (output.budget && !budgets.includes(String(output.budget))) throw new HttpError(400, 'Unknown budget.')
  if (output.pace && !paces.includes(String(output.pace))) throw new HttpError(400, 'Unknown pace.')
  for (const key of ['moodPreferences', 'accommodationPreferences', 'ageGroups', 'priorities']) {
    if (input[key] === undefined) continue
    output[key] = input[key] === null ? [] : strings(input[key], key === 'moodPreferences' ? 3 : 12, 100)
  }
  if (output.moodPreferences) {
    const values = (output.moodPreferences as string[]).map(moodName)
    if (values.some(value => !moods.includes(value))) throw new HttpError(400, 'Unknown travel mood.')
    output.moodPreferences = values
  }
  for (const key of ['daysCount', 'peopleCount']) {
    if (input[key] === undefined) continue
    const value = input[key]
    if (value !== null && (!Number.isInteger(value) || Number(value) < 1 || Number(value) > (key === 'daysCount' ? 30 : 100))) throw new HttpError(400, `Invalid ${key}.`)
    output[key] = value
  }
  if (input.kidsInvolved !== undefined) {
    if (typeof input.kidsInvolved !== 'boolean') throw new HttpError(400, 'Invalid child traveller selection.')
    output.kidsInvolved = input.kidsInvolved
  }
  for (const key of ['dates', 'locationPreferences']) {
    if (input[key] === undefined) continue
    if (input[key] === null) { output[key] = null; continue }
    const values = record(input[key])
    const allowed = key === 'dates' ? ['start', 'end', 'flexible'] : ['scope', 'destination']
    const result: Record<string, unknown> = {}
    for (const field of allowed) {
      const item = values[field]
      if (item === undefined) continue
      if (field === 'flexible') { if (typeof item !== 'boolean') throw new HttpError(400, 'Invalid flexible dates.'); result[field] = item }
      else { if (item !== null && (typeof item !== 'string' || item.length > 150)) throw new HttpError(400, `Invalid ${field}.`); result[field] = item }
    }
    output[key] = result
  }
  return output
}
