import { useEffect, useState } from 'react'

export type InrRate = { base: string; quote: 'INR'; rate: number; date: string }
type CachedRate = { value: InrRate; checked: number }
const storageKey = 'gotogether.inr-rates.v1'
const maxAge = 7 * 24 * 60 * 60 * 1000
const freshFor = 6 * 60 * 60 * 1000
// Verified reference rate; refreshed in the background, never treated as a live quote.
const seed: InrRate = { base: 'USD', quote: 'INR', rate: 96.61, date: '2026-10-08' }
const cached = new Map<string, CachedRate>()
const pending = new Map<string, Promise<InrRate | null>>()
const format = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function validInrRate(value: unknown, base: string, now = Date.now()): value is InrRate {
  const row = value as InrRate | null
  if (!row || row.base !== base || row.quote !== 'INR' || !Number.isFinite(row.rate) || row.rate <= 0 || typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return false
  const age = now - Date.parse(`${row.date}T00:00:00Z`)
  return age >= -86400000 && age <= maxAge
}

function currentRate(base: string): InrRate | null {
  if (base === 'INR') return { base, quote: 'INR', rate: 1, date: new Date().toISOString().slice(0, 10) }
  const entry = cached.get(base)
  if (entry && validInrRate(entry.value, base)) return entry.value
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}')[base] as CachedRate | undefined
    if (saved && validInrRate(saved.value, base)) { cached.set(base, { value: saved.value, checked: Number.isFinite(saved.checked) && saved.checked <= Date.now() ? saved.checked : 0 }); return saved.value }
  } catch { /* Storage is optional. */ }
  return validInrRate(seed, base) ? seed : null
}

async function refreshRate(base: string) {
  if (base === 'INR') return currentRate(base)
  if (!/^[A-Z]{3}$/.test(base)) return null
  const entry = cached.get(base)
  if (entry && Date.now() - entry.checked < freshFor && validInrRate(entry.value, base)) return entry.value
  if (pending.has(base)) return pending.get(base)!
  const request = (async () => {
    try {
      const response = await fetch(`https://api.frankfurter.dev/v2/rate/${base}/INR`, { signal: AbortSignal.timeout(6000) })
      if (!response.ok) return currentRate(base)
      const value: unknown = await response.json()
      if (!validInrRate(value, base)) return currentRate(base)
      cached.set(base, { value, checked: Date.now() })
      try { localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(cached))) } catch { /* Storage is optional. */ }
      return value
    } catch { return currentRate(base) }
    finally { pending.delete(base) }
  })()
  pending.set(base, request)
  return request
}

export function formatInr(amount: number, rate: InrRate | null) {
  if (!Number.isFinite(amount) || amount <= 0) return 'Check price'
  return rate ? format.format(amount * rate.rate) : 'INR estimate unavailable'
}

export function useInrPricing(currency = 'USD') {
  const base = currency.trim().toUpperCase()
  const [result, setResult] = useState<{ base: string; rate: InrRate | null }>(() => ({ base, rate: currentRate(base) }))
  const rate = result.base === base ? result.rate : currentRate(base)
  useEffect(() => {
    let active = true
    void refreshRate(base).then(rate => { if (active) setResult({ base, rate }) })
    return () => { active = false }
  }, [base])
  const note = base === 'INR' ? 'Estimates in INR.' : rate ? `Approx. INR · ${base}/INR reference rate, ${new Date(`${rate.date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}.` : 'INR conversion is temporarily unavailable.'
  return { format: (amount: number) => formatInr(amount, rate), note }
}
