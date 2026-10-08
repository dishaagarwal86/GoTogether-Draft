import { useCallback, useEffect, useRef, useState } from 'react'
import { getQuestJourney, type QuestJourney } from '../apis/quests'

export function useQuestJourney(roomId: string) {
  const [data, setData] = useState<QuestJourney | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const current = useRef('')
  const retry = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    let active = true; let loading = false
    const refresh = async () => {
      if (loading || document.hidden) return
      loading = true
      try {
        const value = await getQuestJourney(roomId)
        if (active) { const signature = JSON.stringify(value); if (signature !== current.current) { current.current = signature; setData(value) }; setError('') }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Your room could not refresh. Your saved work is safe.') }
      finally { loading = false }
    }
    void refresh()
    const interval = window.setInterval(refresh, 6000)
    const updated = () => { void refresh() }
    document.addEventListener('visibilitychange', updated)
    window.addEventListener('gotogether:preferences-updated', updated)
    return () => { active = false; window.clearInterval(interval); document.removeEventListener('visibilitychange', updated); window.removeEventListener('gotogether:preferences-updated', updated) }
  }, [roomId, revision])
  return { data, error, retry }
}
