import { useRef, useState } from 'react'
import { Icon } from './Ui'

export type TravelMode = 'solo' | 'group'

export function TravelModeSwitch({ solo, busy, onChange }: { solo: boolean; busy?: boolean; onChange: (mode: TravelMode) => void }) {
  return <div className="travel-mode-switch" role="group" aria-label="Who’s travelling?">
    <button type="button" aria-pressed={solo} disabled={busy} onClick={() => onChange('solo')}><Icon name="compass" size={17} />Just me</button>
    <button type="button" aria-pressed={!solo} disabled={busy} onClick={() => onChange('group')}><Icon name="people" size={17} />With others</button>
  </div>
}

export function RoomTravelMode({ roomId, solo, hasOthers, busy, onChange }: { roomId: string; solo: boolean; hasOthers: boolean; busy: boolean; onChange: (mode: TravelMode, requestId: string) => Promise<void> }) {
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const [changing, setChanging] = useState(false)
  const pending = useRef<{ mode: TravelMode; id: string } | null>(null)
  const key = `gotogether.mode-change.${roomId}`
  const change = async (mode: TravelMode) => {
    if (busy || changing) return
    setChanging(true); setError('')
    try {
      if (!pending.current) { try { pending.current = JSON.parse(sessionStorage.getItem(key) || 'null') } catch { /* Storage is optional. */ } }
      if (pending.current?.mode !== mode) pending.current = { mode, id: crypto.randomUUID() }
      try { sessionStorage.setItem(key, JSON.stringify(pending.current)) } catch { /* The in-memory ID still protects retries. */ }
      await onChange(mode, pending.current.id)
      try { sessionStorage.removeItem(key) } catch { /* Change already saved. */ }
      pending.current = null; setConfirm(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your travel mode could not save. Try the same choice again.'); setChanging(false) }
  }
  return <section className="room-travel-mode" aria-label="Travel mode">
    <div><div><p className="eyebrow">MAKE THIS CHAPTER YOURS</p><strong>{solo ? 'Your pace. Your possibilities.' : 'Plans change. Your work comes with you.'}</strong></div><TravelModeSwitch solo={solo} busy={busy || changing} onChange={mode => { if ((mode === 'solo') === solo) return; if (mode === 'solo' && hasOthers) setConfirm(true); else void change(mode) }} /></div>
    <p>{changing ? 'Saving your travel mode…' : solo ? 'Choose a plan and make it yours. Bring others along whenever you like.' : hasOthers ? 'Want to travel solo? Make a personal copy while your shared trip stays with the crew.' : 'Switch to Just me to keep this trip and plan at your own pace.'}</p>
    {confirm && <div className="solo-copy-confirm" role="region" aria-label="Create a solo copy"><Icon name="compass" size={26} /><div><h3>A chapter of your own.</h3><p>Your edited itinerary, locked activities, preferences and saved ideas come with you. The shared room, its conversation and everyone’s access stay intact. Your copy starts a fresh edit history.</p><div><button className="primary-button" disabled={busy || changing} onClick={() => void change('solo')}>{changing ? 'Creating your solo trip…' : 'Create my solo copy'}<Icon /></button><button className="text-button" disabled={busy || changing} onClick={() => setConfirm(false)}>Stay with the crew</button></div></div></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}
