export type TravelDates = { start: string; end: string }
export function calendarDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : ''
}

// A wider availability window does not establish which days a shorter trip uses.
// Keep that choice open instead of silently selecting a departure date.
export function resolveTravelDates(saved: unknown, days: number, availability?: { start: string | null; end: string | null; conflict: boolean }): TravelDates | undefined {
  const range = saved && typeof saved === 'object' ? saved as Record<string, unknown> : {}
  const start = calendarDate(range.start), end = calendarDate(range.end)
  if (start && end && start <= end) return { start, end }
  if (availability?.conflict || !Number.isInteger(days) || days < 1) return undefined
  const sharedStart = calendarDate(availability?.start), sharedEnd = calendarDate(availability?.end)
  if (!sharedStart || !sharedEnd || (Date.parse(sharedEnd) - Date.parse(sharedStart)) / 86400000 + 1 !== days) return undefined
  return { start: sharedStart, end: sharedEnd }
}
