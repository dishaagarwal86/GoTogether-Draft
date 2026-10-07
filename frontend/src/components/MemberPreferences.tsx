import { useEffect, useState } from 'react'
import { getRoomPreference, preferenceAnswers, saveTravelDna } from '../apis/travelDna'
import { useAuth } from '../auth/AuthContext'
import type { AnswerValue } from '../data/Questions'
import { readStored } from '../services/journeyStorage'
import { getTravelProfile } from '../services/travelMemoryApi'
import { Icon, LoadingState } from './Ui'

type Answers = Record<string, AnswerValue>
const moodOptions = ['Food & local culture', 'Nature', 'Relaxation', 'Adventure', 'History', 'Wellness', 'Nightlife', 'Family fun', 'Shopping']
const paces = ['Slow & relaxed', 'A balanced mix', 'Busy & activity-filled']
const defaults: Answers = { tripLength: '4 days', flexibleDates: 'yes', budget: 'Flexible', tripFeeling: [], pace: '', companions: 'friends' }

export function MemberPreferences({ roomId, name, solo = false, onSaved, onClose }: { solo?: boolean; roomId: string; name: string; onSaved: () => void; onClose: () => void }) {
  const { user } = useAuth()
  const [initial, setInitial] = useState<Answers | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [memory, setMemory] = useState('')
  useEffect(() => {
    let active = true
    getRoomPreference(user!.id, roomId).then(async preference => {
      const answers = preference ? preferenceAnswers(preference) : { ...defaults }
      if (solo) { answers.companions = 'solo'; answers.groupSize = '1' }
      else if (answers.companions === 'solo') answers.companions = 'friends'
      if (preference?.daysCount) answers.tripLength = `${preference.daysCount} days`
      const profile = await getTravelProfile().catch(() => null)
      if (profile?.settings.useEnabled && answers.personalizationEnabled !== 'no') {
        const memories = profile.memories.filter(item => item.context === 'any' || item.context === (answers.companions || 'friends'))
        const interests = memories.filter(item => item.feature === 'interest').map(item => item.value === 'Food & Culture' ? 'Food & local culture' : item.value).filter(value => moodOptions.includes(value))
        if (!(answers.tripFeeling as string[] | undefined)?.length && interests.length) answers.tripFeeling = interests.slice(0, 3)
        if (!answers.pace) answers.pace = memories.find(item => item.feature === 'pace')?.value ?? ''
        if (active && memories.length) setMemory('Your remembered style gives you a head start. Review what fits this trip before confirming.')
      }
      if (active) setInitial(answers)
    }).catch(() => { if (active) setError('Your saved preferences could not load. Retry before making changes.') })
    return () => { active = false }
  }, [roomId, user, retry, solo])
  if (error) return <div role="alert">{error}<button onClick={() => { setError(''); setRetry(value => value + 1) }}>Retry</button><button onClick={onClose}>Close</button></div>
  if (!initial) return <LoadingState label="Opening your travel style…" />
  return <PreferenceCards initial={initial} storageKey={`gotogether.room-preferences.${user!.id}.${roomId}`} memory={memory} onCancel={onClose} onSave={async answers => { await saveTravelDna(name, { ...answers, companions: solo ? 'solo' : answers.companions === 'solo' ? 'friends' : answers.companions, ...(solo ? { groupSize: '1' } : {}) }, undefined, { roomId, submitted: true }); onSaved() }} />
}

export function PreferenceCards({ initial = defaults, storageKey, memory, onSave, onCancel, guest = false }: { initial?: Answers; storageKey: string; memory?: string; guest?: boolean; onSave: (answers: Answers) => Promise<void>; onCancel?: () => void }) {
  const [answers, setAnswers] = useState<Answers>(() => readStored(storageKey, { ...defaults, ...initial }))
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draftSaved, setDraftSaved] = useState(false)
  const change = (key: string, value: AnswerValue) => {
    const next = { ...answers, [key]: value }; setAnswers(next); setError('')
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setDraftSaved(true) } catch { setDraftSaved(false) }
  }
  const text = (key: string) => String(answers[key] ?? '')
  const selectedMoods = Array.isArray(answers.tripFeeling) ? answers.tripFeeling : []
  const advance = async () => {
    if (step === 0 && answers.flexibleDates !== 'yes' && (!answers.startDate || !answers.endDate || answers.startDate > answers.endDate)) { setError('Choose a valid date window or mark your dates as flexible.'); return }
    if (step === 1 && (!selectedMoods.length || !answers.pace)) { setError('Choose at least one interest and a travel pace.'); return }
    if (step < 2) { setStep(step + 1); return }
    setBusy(true); setError('')
    try { await onSave(answers); try { localStorage.removeItem(storageKey) } catch { /* Server save is durable. */ } }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Your preferences could not save. Please try again.') }
    finally { setBusy(false) }
  }
  return <section className="member-preferences" aria-label="Your trip preferences"><header><p className="eyebrow">YOUR VOICE IN THIS TRIP</p><h2>{['A little room to escape.', 'Your kind of good day.', 'The things that matter.'][step]}</h2><p>{['A date window and a budget that feel comfortable.', 'A few choices. A little more you.', 'Anything essential—or something you would rather skip?'][step]}</p>{memory && <p className="member-memory"><Icon name="leaf" size={16} />{memory}</p>}</header><div className="member-step-tabs" role="group" aria-label="Preference steps">{['Dates & comfort', 'Your rhythm', 'Essentials'].map((label, index) => <button key={label} disabled={index > step || busy} aria-pressed={step === index} onClick={() => setStep(index)}>{index + 1}<span>{label}</span></button>)}</div>
    <fieldset disabled={busy}>
    {step === 0 && <>{guest && <label>Your name<input value={text('displayName')} maxLength={80} onChange={event => change('displayName', event.target.value)} placeholder="What should your crew call you?" /></label>}<label className="member-check"><input type="checkbox" checked={answers.flexibleDates === 'yes'} onChange={event => change('flexibleDates', event.target.checked ? 'yes' : 'no')} />My dates are flexible</label>{answers.flexibleDates !== 'yes' && <div className="member-fields"><label>Available from<input type="date" value={text('startDate')} onChange={event => change('startDate', event.target.value)} /></label><label>Available until<input type="date" value={text('endDate')} min={text('startDate')} onChange={event => change('endDate', event.target.value)} /></label></div>}<div className="member-fields"><label>How long feels right?<select value={String(Number.parseInt(text('tripLength'), 10) || (text('tripLength') === 'Weekend' ? 2 : 4))} onChange={event => change('tripLength', `${event.target.value} days`)}>{Array.from({ length: 30 }, (_, index) => index + 1).map(day => <option value={day} key={day}>{day} days</option>)}</select></label><label>Budget comfort<select value={text('budget') || 'Flexible'} onChange={event => change('budget', event.target.value)}><option value="Flexible">Open to options</option><option>Budget-friendly</option><option>Moderate</option><option>Premium</option></select></label></div><p className="member-hint">A planning range, not a booking price. Check exact costs before booking.</p><details><summary>A destination or departure city in mind?</summary><div className="member-fields"><label>Destination<input value={text('destination')} maxLength={100} onChange={event => change('destination', event.target.value)} placeholder="Happy to discover" /></label><label>Travelling from<input value={text('travellingFrom')} maxLength={100} onChange={event => change('travellingFrom', event.target.value)} placeholder="Your departure city" /></label></div><label className="member-check"><input type="checkbox" checked={answers.destinationFixed === 'yes'} disabled={!text('destination')} onChange={event => change('destinationFixed', event.target.checked ? 'yes' : 'no')} />This destination is essential for me</label></details></>}
    {step === 1 && <><p className="member-label">What lights you up? <span>Choose up to three</span></p><div className="member-choice-grid">{moodOptions.map((mood, index) => <button type="button" key={mood} aria-pressed={selectedMoods.includes(mood)} disabled={!selectedMoods.includes(mood) && selectedMoods.length >= 3} onClick={() => change('tripFeeling', selectedMoods.includes(mood) ? selectedMoods.filter(item => item !== mood) : [...selectedMoods, mood])}><Icon name={['sun', 'leaf', 'moon', 'compass', 'camera', 'heart', 'spark', 'people', 'home'][index]} size={21} />{mood}</button>)}</div><p className="member-label">And your ideal pace?</p><div className="member-pace">{paces.map((pace, index) => <button type="button" aria-pressed={answers.pace === pace} key={pace} onClick={() => change('pace', pace)}><Icon name={['leaf', 'sun', 'compass'][index]} size={19} /><span>{pace}<small>{['Slow mornings. Room to wander.', 'A few highlights and breathing room.', 'An adventure around every corner.'][index]}</small></span></button>)}</div></>}
    {step === 2 && <><label>Something you would love<textarea rows={2} value={text('mustHave')} maxLength={1000} onChange={event => change('mustHave', event.target.value)} placeholder="A food market, a sunrise, a long lunch…" /></label><label>Anything you would rather avoid?<textarea rows={2} value={text('noGo')} maxLength={1000} onChange={event => change('noGo', event.target.value)} placeholder="Crowds, long drives, very early starts…" /></label><div className="member-recap"><Icon name="check" size={22} /><div><strong>Your little travel portrait</strong><p>{text('tripLength')} · {text('budget')} · {text('pace')}</p><p>{selectedMoods.join(' · ')}</p></div></div>{!guest && <label className="member-check"><input type="checkbox" checked={answers.personalizationEnabled !== 'no'} onChange={event => change('personalizationEnabled', event.target.checked ? 'yes' : 'no')} />Use my remembered style where I leave something open</label>}<p className="member-hint">Your answers shape this trip. Your detailed preferences stay private.</p></>}
    </fieldset>{error && <p className="form-error" role="alert">{error}</p>}<footer>{step > 0 ? <button type="button" disabled={busy} onClick={() => setStep(step - 1)}>← Back</button> : <button type="button" disabled={busy} onClick={onCancel}>Back to the room</button>}<small>{draftSaved ? 'Draft saved in this browser' : `${step + 1} of 3`}</small><button className="primary-button" disabled={busy} onClick={() => void advance()}>{busy ? 'Saving your voice…' : step === 2 ? 'My preferences are ready' : 'Continue'}<Icon /></button></footer>
  </section>
}
