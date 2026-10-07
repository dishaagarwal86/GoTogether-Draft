import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getTravelProfile, memoryLabel, tripContexts, type TravelProfile } from '../services/travelMemoryApi'
import { saveTravelDna } from '../apis/travelDna'
import { readStored } from '../services/journeyStorage'
import { TravelModeSwitch } from '../components/TravelModeSwitch'
import { Icon } from '../components/Ui'
import { DetailedCreateRoomPage } from './DetailedCreateRoomPage'
import { destinationPhotos } from '../data/destinationPhotos'
import { exploreItineraries } from '../data/exploreItineraries'
import type { AnswerValue } from '../data/Questions'

type Seed = { note: string; destination?: string; days: string; budget: string; pace: string; context?: string; personalization?: boolean; roomId?: string; members?: string }
const starts = [
  { place: 'Kyoto', mood: 'Little lanes. Long lunches.', image: destinationPhotos.kyoto, note: 'Four days in Kyoto, food and local culture, at a relaxed pace.' },
  { place: 'Bali', mood: 'A little less on the agenda.', image: destinationPhotos.bali, note: 'Four days in Bali, nature, good food and slow mornings.' },
  { place: 'Kerala', mood: 'Take the scenic route.', image: destinationPhotos.kerala, note: 'Three days in Kerala, backwaters and a relaxed pace.' },
]
const destinations = ['Santorini', 'Bali', 'Amalfi Coast', 'Kyoto', 'Interlaken', 'Marrakech', 'Barcelona', 'Cappadocia', 'Kerala', 'Reykjavík', 'Queenstown', 'Tulum', 'Hoi An', 'Cape Town', 'Madeira', 'Banff', 'Zanzibar', 'Oaxaca', 'Edinburgh', 'Luang Prabang', 'Palawan', 'Patagonia', 'Ubud', 'Valletta']

export function CreateRoomPage() {
  const [params] = useSearchParams()
  return params.get('details') === '1' ? <DetailedCreateRoomPage /> : <QuickStart />
}
function QuickStart() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const inspiration = exploreItineraries.find(trip => trip.id === params.get('inspiration'))
  const place = inspiration?.destination ?? params.get('destination')?.slice(0, 100) ?? ''
  const duration = Number(params.get('days'))
  const key = `gotogether.quick-start.${user!.id}`
  const [seed, setSeed] = useState<Seed>(() => readStored(key, { note: place ? `A few good days in ${place}.` : '', destination: place, days: Number.isInteger(duration) && duration >= 1 && duration <= 30 ? String(duration) : '4', budget: 'Flexible', pace: '' }))
  const solo = (seed.members ?? (seed.context === 'solo' ? '1' : '2')) === '1'
  const [profile, setProfile] = useState<TravelProfile | null>(null)
  useEffect(() => { let active = true; getTravelProfile().then(value => { if (active) setProfile(value) }).catch(() => {}); return () => { active = false } }, [])
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [stored, setStored] = useState(false)
  const update = (next: Seed) => { setSeed(next); setError(''); try { localStorage.setItem(key, JSON.stringify(next)); setStored(true) } catch { setStored(false) } }
  const choose = (start: typeof starts[number]) => update({ ...seed, note: start.note, destination: start.place, days: start.place === 'Kerala' ? '3' : '4', pace: 'Slow & relaxed' })
  const begin = async () => {
    if (busy) return
    setBusy(true); setError(''); setStage('Saving your starting idea…')
    const words = seed.note.toLowerCase()
    const destination = seed.destination?.trim() ?? ''
    const days = seed.days
    const wanted = words.replace(/(?:\bno\b|\bskip\b|\bavoid\b)\s+[^.!?;\n]+/g, '')
    const moods = [/food|culture/.test(wanted) ? 'Food & local culture' : '', /nature|garden|forest/.test(wanted) ? 'Nature' : '', /relax|slow|beach/.test(wanted) ? 'Relaxation' : '', /adventure/.test(wanted) ? 'Adventure' : ''].filter(Boolean).slice(0, 3)
    const noGo = seed.note.match(/(?:\bno\b|\bskip\b|\bavoid\b)\s+[^.!?;\n]+/gi)?.join('; ') ?? ''
    const answers: Record<string, AnswerValue> = { groupSize: solo ? '1' : seed.members ?? '2', companions: solo ? 'solo' : seed.context ?? 'leisure', personalizationEnabled: seed.personalization === false ? 'no' : 'yes', destination, destinationFixed: '', flexibleDates: 'yes', tripLength: `${days} days`, budget: seed.budget, pace: seed.pace || (/relaxed|slow/.test(wanted) ? 'Slow & relaxed' : ''), tripFeeling: moods, niceToHave: seed.note, noGo }
    try {
      const saved = await saveTravelDna(destination ? `${solo ? 'My' : 'Our'} ${destination} chapter` : solo ? 'My next escape' : 'Our next escape', answers, undefined, { submitted: false, roomId: seed.roomId, onRoomCreated: id => update({ ...seed, roomId: id }) })
      try { localStorage.removeItem(key) } catch { /* A completed draft does not block navigation. */ }
      navigate(`/quests/${saved.roomId}?tab=crew`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not save your idea. Your text is still here.') }
    finally { setBusy(false) }
  }
  return <section className="quick-start"><div className="quick-start-top"><Link to="/trips">← Your travel book</Link><Link to="/workspace-preview">Try the workspace <Icon name="northeast" size={15} /></Link></div><div className="quick-start-heading"><span className="quick-start-emblem"><Icon name="plane" size={28} /></span><p className="canvas-kicker">BIG MEMORIES START WITH A LITTLE WHAT IF</p><h1>Where shall<br />we <em>disappear to?</em></h1><p>A place, a feeling, a half-formed idea.<br />Bring what you have. We’ll start there.</p></div>
    {profile && profile.memories.length > 0 && <aside className="quick-start-memory"><div><Icon name="leaf" size={17} /><strong>A little head start, from you.</strong><Link to="/travel-style">My travel style ↗</Link></div><p>{profile.memories.filter(item => item.context === 'any' || item.context === (seed.context ?? 'leisure')).slice(0, 3).map(memoryLabel).join(' · ') || 'Your memories apply when the kind of trip matches.'}</p><label><input type="checkbox" checked={seed.personalization !== false && profile.settings.useEnabled} disabled={!profile.settings.useEnabled} onChange={event => update({ ...seed, personalization: event.target.checked })} />{profile.settings.useEnabled ? 'Use my style where I haven’t chosen something different' : 'Using memories is paused in your travel style settings'}</label></aside>}
    <form className="quick-start-composer" onSubmit={event => { event.preventDefault(); void begin() }}><TravelModeSwitch solo={solo} busy={busy} onChange={mode => update({ ...seed, members: mode === 'solo' ? '1' : String(Math.max(2, Number(seed.members) || 2)), context: mode === 'solo' ? 'solo' : seed.context === 'solo' ? 'friends' : seed.context })} /><label className="sr-only" htmlFor="trip-idea">Your trip idea</label><textarea id="trip-idea" value={seed.note} onChange={event => { const note = event.target.value; const count = note.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\b/i)?.[1]?.toLowerCase(); const number = count ? Number(count) || ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].indexOf(count) + 1 : 0; update({ ...seed, note, destination: destinations.find(value => note.toLowerCase().includes(value.toLowerCase())) ?? seed.destination, days: number > 0 && number <= 30 ? String(number) : seed.days }) }} maxLength={900} rows={3} placeholder="A few days in Kyoto. Good food, slow mornings, and room to wander…" disabled={busy} /><div className="quick-start-choices"><label><Icon name="pin" size={15} /><span className="sr-only">Destination</span><input aria-label="Destination" placeholder="Anywhere · or name a place" maxLength={100} value={seed.destination ?? ''} onChange={event => update({ ...seed, destination: event.target.value })} disabled={busy} /></label><label><Icon name="calendar" size={15} /><span className="sr-only">Trip length</span><select value={seed.days} onChange={event => update({ ...seed, days: event.target.value })} disabled={busy}>{Array.from({ length: 30 }, (_, index) => index + 1).map(days => <option value={days} key={days}>{days} days</option>)}</select></label><label><Icon name="wallet" size={15} /><span className="sr-only">Budget style</span><select value={seed.budget} onChange={event => update({ ...seed, budget: event.target.value })} disabled={busy}><option value="Flexible">Budget open</option><option>Budget-friendly</option><option>Moderate</option><option>Premium</option></select></label><label><Icon name="sun" size={15} /><span className="sr-only">Travel pace</span><select value={seed.pace} onChange={event => update({ ...seed, pace: event.target.value })} disabled={busy}><option value="">Find our rhythm</option><option value="Slow & relaxed">Take it slow</option><option value="A balanced mix">A little of everything</option><option value="Busy & activity-filled">Make the most of it</option></select></label><label><Icon name="people" size={15} /><span className="sr-only">Kind of trip</span><select aria-label="Kind of trip" value={seed.context ?? 'leisure'} disabled={busy} onChange={event => update({ ...seed, context: event.target.value, members: event.target.value === 'solo' ? '1' : solo ? '2' : seed.members })}>{tripContexts.map(value => <option key={value} value={value}>{value} trip</option>)}</select></label></div>{!solo && <label className="quick-start-group-size">Travellers, including you<input aria-label="Travellers, including you" type="number" min="1" max="60" value={seed.members ?? '2'} onChange={event => update({ ...seed, members: event.target.value, context: event.target.value === '1' ? 'solo' : seed.context })} required disabled={busy} /><small>You can change this later.</small></label>}<div className="quick-start-submit"><span>{busy ? stage : stored ? 'Your idea is saved in this browser' : solo ? 'Your pace. Your preferences. Your next chapter.' : 'Your room comes first. Everyone’s preferences come next.'}</span><button type="submit" disabled={busy}>{busy ? 'A little moment…' : solo ? 'Start my solo trip' : 'Create our room'}<Icon size={18} /></button></div>{error && <p className="form-error" role="alert">{error}</p>}</form>
    <div className="quick-start-secondary"><span>Prefer to get specific?</span><Link to="/travel-dna/new?details=1">Add dates and details <Icon name="northeast" size={13} /></Link></div>
    <div className="quick-start-inspiration"><div><p className="canvas-kicker">OR FOLLOW A LITTLE CURIOSITY</p><span>You don’t have to know yet.</span></div><div className="quick-start-postcards">{starts.map(start => <button type="button" key={start.place} disabled={busy} onClick={() => choose(start)}><img src={start.image} alt="" /><div><small>A POSSIBLE NEXT CHAPTER</small><strong>{start.place}</strong><span>{start.mood}</span></div><i><Icon name="northeast" size={18} /></i></button>)}</div></div>
  </section>
}
