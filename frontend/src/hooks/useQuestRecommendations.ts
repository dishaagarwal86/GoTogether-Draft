import { useCallback, useEffect, useState } from 'react'
import { getQuestRecommendations } from '../apis/quests'
export function useQuestRecommendations(roomId: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getQuestRecommendations>> | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const retry = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => { let active = true; if (!roomId) return; Promise.resolve().then(() => { if (active) { setData(null); setError('') }; return getQuestRecommendations(roomId) }).then((result) => { if (active) setData(result) }).catch(() => { if (active) setError('We couldn’t load this quest’s travel ideas. Please try again.') }); return () => { active = false } }, [roomId, revision])
  useEffect(() => {
    const updated = (event: Event) => { if ((event as CustomEvent<string>).detail === roomId) retry() }
    window.addEventListener('gotogether:preferences-updated', updated)
    return () => window.removeEventListener('gotogether:preferences-updated', updated)
  }, [roomId, retry])
  return { data, error, retry }
}
