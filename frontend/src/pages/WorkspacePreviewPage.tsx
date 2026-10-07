import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TripCanvas } from '../components/TripCanvas'
import { Icon } from '../components/Ui'
import type { PlanCommand, PlanItem, WorkingPlan } from '../services/workingPlanApi'

const moment = (id: string, title: string, kind: PlanItem['kind'], time: string, duration: number, note: string): PlanItem => ({ id, title, kind, time, duration, note, locked: false })
const initial: WorkingPlan = { title: 'Our Kyoto chapter', destination: 'Kyoto', country: 'Japan', catalogueId: 'preview', revision: 1, canUndo: false, updatedAt: '', days: [
  { id: 'day-1', title: 'Day 1', items: [moment('tea', 'Slow mornings & a cup of matcha', 'food', '10:00', 60, 'Find a little tea house. Take the window seat. Let the city come to you.'), moment('lanes', 'Get a little lost in the old lanes', 'experience', '12:00', 90, 'Wooden storefronts, tiny shops, and the kind of detour you came for.'), moment('space', 'An afternoon with no plans', 'free', '15:00', 120, 'A book by the river? Another café? This part is entirely yours.'), moment('dinner', 'A table for all of us', 'food', '19:00', 90, 'End the day somewhere cosy. Pick a place together before heading out.')] },
  { id: 'day-2', title: 'Day 2', items: [moment('forest', 'A little green, a little quiet', 'experience', '10:00', 120, 'Research a garden or forest walk that suits everyone’s walking comfort.'), moment('lunch', 'Lunch that becomes an afternoon', 'food', '13:00', 90, 'Leave enough time for another conversation.'), moment('makers', 'Meet the makers', 'experience', '16:00', 90, 'Look for a local craft workshop. Check availability and cost.')] },
  { id: 'day-3', title: 'Day 3', items: [moment('market', 'One last market wander', 'experience', '10:00', 90, 'A small souvenir and one more thing to taste.'), moment('goodbye', 'A slow goodbye', 'free', '14:00', 60, 'Keep a buffer for your journey home.')] },
] }

export function WorkspacePreviewPage() {
  const [plan, setPlan] = useState<WorkingPlan>(() => structuredClone(initial))
  const [history, setHistory] = useState<WorkingPlan[]>([])
  const [error, setError] = useState('')
  const change = async (command: PlanCommand) => {
    setError('')
    if (command.type === 'undo') {
      const previous = history.at(-1)
      if (previous) { setPlan({ ...previous, canUndo: history.length > 1 }); setHistory(values => values.slice(0, -1)) }
      return Boolean(previous)
    }
    const next = structuredClone(plan)
    const source = next.days.find(day => day.items.some(item => item.id === command.itemId))
    const item = source?.items.find(value => value.id === command.itemId)
    const target = next.days.find(day => day.id === command.dayId)
    if (item?.locked && command.type !== 'lock') { setError('Unlock this activity before changing it.'); return false }
    if (command.type === 'rename') next.title = command.title!
    else if (command.type === 'add' && target) target.items.push({ id: crypto.randomUUID(), title: command.title!, kind: command.kind!, time: command.time!, duration: command.duration!, note: command.note ?? '', locked: false })
    else if (item && source) {
      if (command.type === 'lock') item.locked = !item.locked
      if (command.type === 'remove') source.items = source.items.filter(value => value.id !== item.id)
      if (command.type === 'update') Object.assign(item, { title: command.title, kind: command.kind, time: command.time, duration: command.duration, note: command.note })
      if (command.type === 'move' && target) { source.items = source.items.filter(value => value.id !== item.id); target.items.splice(command.index!, 0, item) }
    } else return false
    setHistory(values => [...values, plan].slice(-30)); setPlan({ ...next, revision: next.revision + 1, canUndo: true }); return true
  }
  return <TripCanvas preview plan={plan} saving={false} error={error} status="Preview · try an edit" onChange={change}
    renderCompanion={context => <div className="canvas-demo-chat"><span className="canvas-demo-orb"><Icon name="spark" size={25} /></span><h2>A little help,<br /><em>right here.</em></h2><p>Keep your itinerary in view while you talk through an idea.</p>{context && <div className="canvas-context"><strong>{context.label}</strong><p>{context.detail}</p></div>}<div className="canvas-chat-example">“A slower afternoon, but keep dinner with everyone.”</div><p>This preview shows where your private planning conversation lives. Create a quest to use Companion.</p><Link className="primary-button" to="/travel-dna/new">Start a real trip <Icon /></Link></div>}
    renderCrew={(_open, context) => <div className="canvas-demo-chat"><Icon name="people" size={30} /><h2>Good plans have<br /><em>good company.</em></h2><p>Your crew’s conversation stays beside the plan. Share a day or a specific activity without losing your place.</p>{context && <div className="canvas-context"><strong>{context.label}</strong><p>{context.detail}</p></div>}<p className="canvas-demo-note">Sample workspace · no messages are sent.</p><Link className="primary-button" to="/travel-dna/new">Plan with your people <Icon /></Link></div>}
  />
}
