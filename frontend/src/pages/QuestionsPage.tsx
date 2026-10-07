import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { getRoomPreference, preferenceAnswers, saveTravelDna } from '../apis/travelDna'
import type { AnswerValue } from '../data/Questions'
import { useAuth } from '../auth/AuthContext'
import { draftKey, emptyDraft, readStored, writeStored, type QuestDraft } from '../services/journeyStorage'
import { PreferenceNudge } from '../components/PreferenceNudge'
import { ErrorState, Icon, LoadingState } from '../components/Ui'

const steps = [{ name: 'The basics', note: 'A little shape to your escape', icon: 'calendar' }, { name: 'Your comfort zone', note: 'A budget that feels good', icon: 'sun' }, { name: 'Your travel rhythm', note: 'The things that light you up', icon: 'compass' }, { name: 'The little details', note: 'Make room for what matters', icon: 'spark' }]
function Choices({ label, options, value, onChange, multi = false, limit }: { label: string; options: string[]; value?: AnswerValue; onChange: (value: AnswerValue) => void; multi?: boolean; limit?: number }) {
  const values = Array.isArray(value) ? value : []
  return <div className="preference-choices" role="group" aria-label={label}>{options.map((option) => { const selected = multi ? values.includes(option) : value === option; return <button type="button" className={selected ? 'selected' : ''} key={option} aria-pressed={selected} disabled={multi && !selected && Boolean(limit && values.length >= limit)} onClick={() => onChange(multi ? selected ? values.filter((item) => item !== option) : [...values, option] : option)}>{option}<span>{selected ? <Icon name="check" size={16} /> : <i />}</span></button> })}</div>
}
function Question({ title, note, children }: { title: string; note?: string; children: ReactNode }) { return <fieldset className="preference-question"><legend>{title}</legend>{note && <p>{note}</p>}{children}</fieldset> }
export function QuestionsPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const roomId = params.get('roomId') ?? undefined
  const key = draftKey(user!.id, roomId)
  const navigate = useNavigate()
  const [draft, setDraft] = useState<QuestDraft>(() => readStored(key, { ...emptyDraft, name: roomId ? 'Your quest' : '' }))
  const [loading, setLoading] = useState(Boolean(roomId))
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [revision, setRevision] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (!roomId) return
    let active = true
    Promise.resolve().then(() => { if (active) { setLoading(true); setLoadError('') }; return getRoomPreference(user!.id, roomId) }).then((preference) => { if (active && preference && !localStorage.getItem(key)) setDraft({ ...emptyDraft, name: 'Your quest', roomId, answers: preferenceAnswers(preference) }) }).catch(() => { if (active) setLoadError('We couldn’t load your saved preferences. Please try again before making changes.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [roomId, user?.id, key, revision])
  const persist = (next: QuestDraft) => { setDraft(next); writeStored(key, next) }
  const update = (id: string, value: AnswerValue) => { persist({ ...draft, answers: { ...draft.answers, [id]: value } }); setError('') }
  const answers = draft.answers
  const step = Math.min(3, Math.max(0, draft.step))
  const changeStep = (next: number) => { persist({ ...draft, step: next }); setError(''); window.scrollTo({ top: 0, behavior: 'instant' }); window.setTimeout(() => heading.current?.focus(), 0) }
  const validate = () => {
    if (step === 0) {
      if (answers.flexibleDates !== 'yes' && (!answers.startDate || !answers.endDate)) return 'Choose your travel dates, or let us know they’re flexible.'
      if (answers.flexibleDates !== 'yes' && String(answers.endDate) < String(answers.startDate)) return 'Your return date should be on or after your departure.'
      if (!answers.tripLength) return 'Choose roughly how long you’d like to be away.'
      if (!answers.companions) return 'Tell us who you’re travelling with.'
      if (!Number(answers.groupSize) || Number(answers.groupSize) < 1 || Number(answers.groupSize) > 60 || !Number.isInteger(Number(answers.groupSize))) return 'Your group size should be a whole number between 1 and 60.'
    }
    if (step === 1 && !answers.budget) return 'Choose a budget style that feels comfortable.'
    if (step === 2 && (!Array.isArray(answers.tripFeeling) || !answers.tripFeeling.length || !answers.pace)) return 'Choose at least one travel mood and your preferred pace.'
    return ''
  }
  const advance = async () => {
    const issue = validate(); if (issue) { setError(issue); return }
    if (step < 3) { changeStep(step + 1); return }
    if (saving) return
    setSaving(true); setError('')
    try {
      const result = await saveTravelDna(draft.name, answers, draft.email, { roomId: roomId ?? draft.roomId, onRoomCreated: (created) => { const next = { ...draft, roomId: created }; setDraft(next); writeStored(key, next) } })
      localStorage.removeItem(key)
      navigate(`/quests/${result.roomId}`, { replace: true, state: { saved: true, invitation: result.invitation } })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We couldn’t save your quest. Your draft is safe here; please try again.') }
    finally { setSaving(false) }
  }
  if (loading) return <LoadingState label="Listening for the parts of the plan your group can share…" />
  if (loadError) return <ErrorState message={loadError} retry={() => setRevision((value) => value + 1)} />
  if (!roomId && !draft.name) return <Navigate to="/travel-dna/new" replace />
  const choice = (id: string, label: string, options: string[], multi = false, limit?: number) => <Choices label={label} options={options} value={answers[id]} onChange={(value) => update(id, value)} multi={multi} limit={limit} />
  return <section className="preferences-page"><div className="builder-topbar"><Link className="back-link" to={roomId ? `/quests/${roomId}` : '/travel-dna/new'}>← {roomId ? 'Your quest' : 'Quest details'}</Link><span><Icon name="check" size={14} /> DRAFT SAVED IN THIS BROWSER</span></div><div className="preferences-layout"><aside className="preferences-sidebar"><p className="eyebrow">{draft.name}</p><h2>Tell us what makes<br />a trip feel <em>worth it.</em></h2><p>Your answers stay yours.<br />They help make room for every voice.</p><ol className="preference-steps">{steps.map((item, index) => <li key={item.name} className={index === step ? 'current' : index < step ? 'complete' : ''}><button type="button" disabled={index > step || saving} aria-current={index === step ? 'step' : undefined} onClick={() => changeStep(index)}><span>{index < step ? <Icon name="check" size={17} /> : String(index + 1).padStart(2, '0')}</span><div><strong>{item.name}</strong><small>{item.note}</small></div></button></li>)}</ol><div className="preferences-aside-note"><Icon name="people" size={24} /><p>Your preferences are your voice.<br />Everyone gets to share theirs.</p></div></aside><div className="preferences-content"><div className="preference-progress" aria-label={`Step ${step + 1} of 4`}>{steps.map((item, index) => <span className={index <= step ? 'filled' : ''} key={item.name} />)}</div><p className="eyebrow">STEP {String(step + 1).padStart(2, '0')} OF 04</p><h1 ref={heading} tabIndex={-1}>{steps[step].name}<em>.</em></h1><p className="preferences-step-intro">{['The when, the who, and the wherever. A rough idea is all you need.', 'Everyone’s comfortable looks a little different. Here’s yours.', 'Slow mornings or sunrise hikes? There’s room for your kind of good day.', 'The must-do, the maybe, and the rather-not. All of it matters.'][step]}</p>
    {step === 0 && <>
      <Question title="When are you thinking?" note="Choose dates, or keep your options open."><div className="journey-date-fields"><label>Departure<input type="date" disabled={answers.flexibleDates === 'yes'} value={String(answers.startDate ?? '')} onChange={(event) => update('startDate', event.target.value)} /></label><span>→</span><label>Return<input type="date" disabled={answers.flexibleDates === 'yes'} min={String(answers.startDate ?? '')} value={String(answers.endDate ?? '')} onChange={(event) => update('endDate', event.target.value)} /></label></div><label className="journey-checkbox"><input type="checkbox" checked={answers.flexibleDates === 'yes'} onChange={(event) => update('flexibleDates', event.target.checked ? 'yes' : '')} /> My dates are flexible <Icon name="sun" size={16} /></label></Question>
      <Question title="How long shall we get away?">{choice('tripLength', 'Trip length', [...new Set(['Weekend', '3–4 days', '5–7 days', 'More than a week', ...(typeof answers.tripLength === 'string' && /^\d+ days$/.test(answers.tripLength) ? [answers.tripLength] : [])])])}</Question>
      <Question title="Who’s coming along?">{choice('companions', 'Travel companions', ['Solo', 'Partner', 'Friends', 'Family', 'Mixed group'])}<label className="group-size-field">How many people, including you?<input type="number" min="1" max="60" value={String(answers.groupSize ?? '')} onChange={(event) => update('groupSize', event.target.value)} placeholder="4" /></label></Question>
      <Question title="Any age groups to plan around?" note="Optional · Choose all that apply.">{choice('ageGroups', 'Age groups', ['Under 12', '13–17', '18–30', '31–50', '51–65', '65+'], true)}</Question>
      <Question title="Where does your mind wander?" note="Optional · You can work this out together later.">{choice('destinationScope', 'Destination scope', ['Within my country', 'Internationally', 'I’m open to both'])}<label className="journey-text-field">A place on your mind<input value={String(answers.destination ?? '')} onChange={(event) => update('destination', event.target.value)} placeholder="Japan, a quiet coast, somewhere new…" maxLength={150} /></label></Question>
    </>}
    {step === 1 && <><Question title="What’s your budget style?" note="For each person’s whole trip. You can discuss exact amounts with your crew.">{choice('budget', 'Budget style', ['Budget-friendly', 'Moderate', 'Premium', 'Flexible'])}</Question><Question title="What feels like a good place to stay?" note="Optional · Choose as many as you like.">{choice('stayStyle', 'Accommodation', ['Hotel', 'Resort', 'Apartment / home rental', 'Villa', 'Hostel / dormitory', 'I’m open to options'], true)}</Question><div className="preference-tip"><Icon name="leaf" /><p>A good trip should feel good before, during, and after. Choose what works for you.</p></div></>}
    {step === 2 && <><Question title="What’s your kind of good day?" note="Choose up to three moods.">{choice('tripFeeling', 'Travel moods', ['Adventure', 'Food & local culture', 'Nature', 'Relaxation', 'Nightlife', 'Family fun', 'Wellness', 'Shopping', 'History'], true, 3)}</Question><Question title="And your ideal rhythm?">{choice('pace', 'Travel pace', ['Slow & relaxed', 'A balanced mix', 'Busy & activity-filled'])}</Question><Question title="How do you like to discover?" note="Optional">{choice('discovery', 'Discovery style', ['Famous highlights', 'Local hidden gems', 'A mix of both'])}</Question><Question title="What matters most?" note="Optional · Pick up to five priorities.">{choice('priorities', 'Travel priorities', ['Food', 'Culture', 'Adventure', 'Nature', 'Relaxation', 'Nightlife', 'Budget', 'Accommodation comfort'], true, 5)}</Question></>}
    {step === 3 && <><PreferenceNudge answers={answers} roomId={roomId || undefined} /><div className="preference-recap"><Icon name="compass" /><div><strong>A little picture of your trip</strong><p>{[answers.tripLength, answers.budget, answers.pace].filter(Boolean).join(' · ')}</p></div></div>{[{ id: 'mustHave', title: 'The one thing you’d love', note: 'A moment that would make this trip yours.', placeholder: 'A long lunch by the sea, a sunrise hike…' }, { id: 'niceToHave', title: 'And if there’s time…', note: 'The lovely extras. No pressure.', placeholder: 'A cooking class, a quiet bookshop, live music…' }, { id: 'noGo', title: 'Anything you’d rather skip?', note: 'Your boundaries belong in the plan, too.', placeholder: 'Early starts, long drives, crowded places…' }].map((item) => <Question title={item.title} note={`${item.note} Optional.`} key={item.id}><textarea aria-label={item.title} rows={3} maxLength={1000} value={String(answers[item.id] ?? '')} onChange={(event) => update(item.id, event.target.value)} placeholder={item.placeholder} /></Question>)}<div className="preference-tip"><Icon name="check" /><p>{roomId ? 'Your updated preferences will help shape your shared plan.' : 'Save your preferences to create your quest and invite your crew.'}</p></div></>}
    {error && <p role="alert" className="form-error">{error}</p>}<div className="preference-bottom"><button type="button" className="text-button" onClick={() => step ? changeStep(step - 1) : navigate(roomId ? `/quests/${roomId}` : '/travel-dna/new')} disabled={saving}>← Back</button><span>{step + 1} of 4</span><button type="button" className="primary-button" onClick={advance} disabled={saving}>{saving ? 'Saving your quest…' : step === 3 ? 'Save my preferences' : 'A little more about you'}<Icon /></button></div>
    </div></div></section>
}
