import { useCallback, useEffect, useState } from 'react'
import { getUserQuests, type Quest } from '../apis/quests'
import { useAuth } from '../auth/AuthContext'
export function useQuests() {
  const { user } = useAuth()
  const userId = user?.id
  const [quests, setQuests] = useState<Quest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const retry = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    let active = true
    if (!userId) return
    Promise.resolve().then(() => { if (active) { setLoading(true); setError('') }; return getUserQuests(userId) }).then((data) => { if (active) setQuests(data) }).catch(() => { if (active) setError('We couldn’t load your quests. Please try again.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId, revision])
  return { quests, loading, error, retry }
}
