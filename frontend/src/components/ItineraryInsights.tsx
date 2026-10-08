import { useEffect, useRef, useState } from 'react'
import type { QuestRecommendation } from '../apis/quests'
import { askCompanion, companionHistory, personaliseItinerary, savedPersonalStory, sourceLabel, type CompanionReply } from '../services/companionApi'
import { Icon } from './Ui'

export function ItineraryInsights({ trip, roomId, version }: { trip: QuestRecommendation; roomId: string; version?: string }) {
  const [personalStory, setPersonalStory] = useState<Awaited<ReturnType<typeof personaliseItinerary>>['data'] | null>(null)
  const [personalising, setPersonalising] = useState(false)
  const [explanation, setExplanation] = useState<CompanionReply | null>(null)
  const [explaining, setExplaining] = useState(false)
  const [storyError, setStoryError] = useState('')
  const requestId = useRef(0)
  useEffect(() => {
    let active = true
    savedPersonalStory(roomId, trip.id).then(result => { if (active) setPersonalStory(result.data) }).catch(() => { if (active) setStoryError('Saved itinerary notes could not be loaded. You can try personalising again.') })
    companionHistory('explain', roomId).then(items => { if (active) setExplanation(items.find(item => item.itineraryId === trip.id) ?? null) }).catch(() => { /* The explain action remains available if history cannot load. */ })
    return () => { active = false }
  }, [roomId, trip.id, version])
  const explain = async () => {
    setExplaining(true); setStoryError('')
    try { setExplanation(await askCompanion({ task: 'explain', roomId, itineraryId: trip.id })) }
    catch (error) { setStoryError(error instanceof Error ? error.message : 'Please try again.') }
    finally { setExplaining(false) }
  }
  const personalise = async () => {
    if (personalising) return
    const id = ++requestId.current
    setPersonalising(true); setStoryError('')
    try {
      const result = await personaliseItinerary(roomId, trip.id)
      if (id === requestId.current) setPersonalStory(result.data)
    } catch { if (id === requestId.current) setStoryError('The Companion couldn’t personalise this just now. Your original itinerary is still here; try again when you’re ready.') }
    finally { if (id === requestId.current) setPersonalising(false) }
  }
  return <div className="itinerary-insights">
    <div className="itinerary-ai-explanation"><button type="button" className="secondary-button" disabled={explaining} onClick={explain}>{explaining ? 'Looking at your shared fit…' : 'Explain this match'}<Icon name="spark" size={17} /></button>{explanation && <div role="status"><small>{sourceLabel(explanation.source)}</small><p>{explanation.summary}</p>{explanation.notice && <p className="companion-notice">{explanation.notice}</p>}</div>}{storyError && <p className="form-error" role="alert">{storyError}</p>}</div>
    <details className="itinerary-companion"><summary><Icon name="spark" size={19} /><span>Make it a little more you.<small>Personalise this idea with the Companion</small></span><Icon name="plus" size={17} /></summary><div><p>Give this starting point a little of your crew’s personality.</p><button className="secondary-button" type="button" disabled={personalising} onClick={personalise}>{personalising ? 'Finding your story…' : 'Personalise with Companion'}<Icon name="spark" size={17} /></button>{personalStory && <section className="companion-story" aria-live="polite"><p className="eyebrow">{sourceLabel(personalStory.source)}</p>{personalStory.notice && <p className="companion-notice">{personalStory.notice}</p>}<h3>{personalStory.resultTitle}</h3><p>{personalStory.scrapbookIntro}</p><ul>{(personalStory.whyItWorks ?? []).map((item) => <li key={item}>{item}</li>)}</ul><p>{personalStory.tradeoffNote}</p><div className="story-days">{personalStory.days.map((day) => <article key={day.day}><b>Day {day.day}</b><p>{day.note}</p></article>)}</div></section>}</div></details>
  </div>
}
