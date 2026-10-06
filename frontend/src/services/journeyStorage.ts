import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { AnswerValue } from '../data/Questions'

export function readStored<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback } }
export function writeStored(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event('journey-storage')) } catch { /* The flow remains usable when browser storage is unavailable. */ } }
export function useSavedTrips() {
  const { user } = useAuth()
  const key = `gotogether.saved.${user?.id ?? 'guest'}`
  const [saved, setSaved] = useState<string[]>(() => readStored(key, []))
  useEffect(() => { const refresh = () => setSaved(readStored(key, [])); refresh(); window.addEventListener('journey-storage', refresh); window.addEventListener('storage', refresh); return () => { window.removeEventListener('journey-storage', refresh); window.removeEventListener('storage', refresh) } }, [key])
  const toggle = useCallback((id: string) => { const current = readStored<string[]>(key, []); writeStored(key, current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }, [key])
  return { saved, toggle }
}
export type QuestDraft = { name: string; email: string; answers: Record<string, AnswerValue>; step: number; roomId?: string }
export const emptyDraft: QuestDraft = { name: '', email: '', answers: {}, step: 0 }
export const draftKey = (userId: string, roomId = 'new') => `gotogether.draft.${userId}.${roomId}`
export function safeNext(search: string, fallback = '/dashboard') {
  const next = new URLSearchParams(search).get('next')
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || /^\/(login|signup)([/?#]|$)/.test(next)) return fallback
  return next
}
