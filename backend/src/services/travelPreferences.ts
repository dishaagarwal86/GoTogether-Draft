import { HttpError } from './access.js'

export const moods = ['Adventure', 'Food & Culture', 'Relaxation', 'Nature', 'Nightlife', 'Wellness', 'Family fun', 'Shopping', 'History']
export const budgets = ['Budget-friendly', 'Moderate', 'Premium', 'Flexible']
export const paces = ['Slow & relaxed', 'A balanced mix', 'Busy & activity-filled']
export type ExtractedPreferences = { moods?: string[]; budget?: string; pace?: string; mustHave?: string; noGo?: string; daysCount?: number }
export const normalize = (text: string) => text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()
export const moodName = (text: string) => /food|culture/.test(normalize(text)) ? 'Food & Culture' : moods.find(value => normalize(value) === normalize(text)) ?? text
export const budgetRank = (value: string) => /budget/i.test(value) ? 0 : /premium|flexible/i.test(value) ? 2 : 1

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Expected an object.')
  return value as Record<string, unknown>
}
export function text(value: unknown, max = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, `Enter text of up to ${max} characters.`)
  return value.trim()
}
export function strings(value: unknown, maxItems = 10, maxLength = 300): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new HttpError(400, 'Invalid list.')
  return [...new Set(value.map(item => text(item, maxLength)))]
}
export function validateExtracted(value: unknown): ExtractedPreferences {
  const input = record(value)
  const allowed = ['moods', 'budget', 'pace', 'mustHave', 'noGo', 'daysCount']
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new HttpError(400, 'Unknown preference field.')
  const output: ExtractedPreferences = {}
  if (input.moods !== undefined) {
    output.moods = strings(input.moods, 3, 40).map(moodName)
    if (output.moods.some(value => !moods.includes(value))) throw new HttpError(400, 'Unknown travel mood.')
  }
  for (const [key, values] of [['budget', budgets], ['pace', paces]] as const) {
    if (input[key] !== undefined) {
      const value = text(input[key], 60)
      if (!values.includes(value)) throw new HttpError(400, `Unknown ${key}.`)
      output[key] = value
    }
  }
  for (const key of ['mustHave', 'noGo'] as const) if (input[key] !== undefined) output[key] = text(input[key], 1000)
  if (input.daysCount !== undefined) {
    if (!Number.isInteger(input.daysCount) || Number(input.daysCount) < 1 || Number(input.daysCount) > 30) throw new HttpError(400, 'Trip length must be between 1 and 30 days.')
    output.daysCount = Number(input.daysCount)
  }
  return output
}

const activityGroups = [
  /\b(hik\w*|trek\w*|trail\w*|climb\w*)\b/,
  /\b(swim\w*|surf\w*|snork\w*|diving|dive|reef\w*|kayak\w*|water activit\w*)\b/,
  /\b(nightlife|late night\w*|after dark|clubb\w*)\b/,
  /\b(early start\w*|early morning\w*|sunrise|dawn)\b/,
  /\b(crowd\w*|busy market\w*)\b/,
  /\b(remote|isolated|off grid)\b/,
  /\b(long driv\w*|driving|road trip\w*|road transfer\w*)\b/,
]
export function violatesNoGo(noGo: string, activities: string): boolean {
  const target = normalize(activities)
  return noGo.split(/[,;\n]|\band\b/i).some(part => {
    const phrase = normalize(part).replace(/^(no|avoid|skip|without)\s+/, '')
    if (!phrase || /^(none|nothing|no restrictions)$/.test(phrase)) return false
    if (activityGroups.some(group => group.test(phrase) && group.test(target))) return true
    const words = phrase.split(' ').filter(word => word.length > 2 && !['the', 'any', 'long', 'very'].includes(word))
    return words.length > 0 && words.every(word => target.includes(word.replace(/s$/, '')))
  })
}
