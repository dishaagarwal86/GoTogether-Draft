import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { updateAnswer } from '../apis/Questions'
import { saveTravelDna } from '../apis/travelDna'
import type { AnswerValue } from '../data/Questions'
import { countries } from '../data/countries'
import { PreferenceNudge } from '../components/PreferenceNudge'

const tripLength = ['Weekend', '3–4 days', '5–7 days', 'More than a week']
const companions = ['Solo', 'Partner', 'Friends', 'Family', 'Mixed group']
const ages = ['Under 12', '13–17', '18–30', '31–50', '51–65', '65+']
const destinationScope = ['Within my country', 'Internationally', 'I’m open to both']
const budgets = ['Budget-friendly', 'Moderate', 'Premium', 'Flexible']
const stays = ['Hotel', 'Resort', 'Apartment / home rental', 'Villa', 'Hostel / dormitory', 'I’m open to options']
const feelings = ['Adventure', 'Food & local culture', 'Nature', 'Relaxation', 'Nightlife', 'Family fun', 'Wellness', 'Shopping', 'History']
const pace = ['Slow & relaxed', 'A balanced mix', 'Busy & activity-filled']
const discovery = ['Famous highlights', 'Local hidden gems', 'A mix of both']
const priorities = ['Food', 'Culture', 'Adventure', 'Nature', 'Relaxation', 'Nightlife', 'Budget', 'Accommodation comfort']

export function QuestionsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const travelDnaName = location.state?.travelDnaName ?? 'Your new quest'
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [countryListOpen, setCountryListOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const update = (id: string, value: AnswerValue) => setAnswers((current) => updateAnswer(current, id, value))
  const toggle = (id: string, value: string, max?: number) => {
    const current = (answers[id] as string[] | undefined) ?? []
    if (current.includes(value)) return update(id, current.filter((item) => item !== value))
    if (max && current.length >= max) return
    update(id, [...current, value])
  }
  const selected = (id: string, value: string) => Array.isArray(answers[id]) && answers[id].includes(value)
  const complete = async () => {
    setIsSaving(true)
    setSaveError('')
    try {
      const saved = await saveTravelDna(travelDnaName, answers)
      navigate('/travel-dna/overview', { state: { travelDnaName, answers, ...saved } })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'We could not save your Travel DNA. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const ChoiceGroup = ({ id, options, multi = false, limit }: { id: string; options: string[]; multi?: boolean; limit?: number }) => <div className="option-grid">
    {options.map((option) => {
      const isSelected = multi ? selected(id, option) : answers[id] === option
      return <button className={isSelected ? 'option-button selected' : 'option-button'} type="button" key={option} onClick={() => multi ? toggle(id, option, limit) : update(id, option)}>{option}{isSelected && <b>✓</b>}</button>
    })}
  </div>
  return <section className="flow-page questions-page">
    <div className="flow-topbar"><Link className="back-link" to="/plan">← Back</Link><span className="flow-step">3 / 3</span></div>
    <div className="flow-heading preference-heading"><p className="eyebrow">{travelDnaName}</p><h1>Make it feel <em>like yours.</em></h1><p className="lede">Tell us a little about the trip you have in mind. We’ll use it to find ideas your whole group will love.</p></div>

    <SectionLabel number="01" title="Trip basics" subtitle="The shape of your next escape" />
    <div className="question-list">
      <Card number="01" title="When would you like to travel?" helper="Select specific dates or choose “My dates are flexible”." className="dates-card"><div className="date-fields"><label>From<input className="question-input" type="date" value={(answers.startDate as string) ?? ''} onChange={(event) => update('startDate', event.target.value)} /></label><span>→</span><label>To<input className="question-input" type="date" value={(answers.endDate as string) ?? ''} onChange={(event) => update('endDate', event.target.value)} /></label></div><button className={answers.flexibleDates === 'yes' ? 'flexible-date active' : 'flexible-date'} type="button" onClick={() => update('flexibleDates', answers.flexibleDates === 'yes' ? '' : 'yes')}><i>✦</i> My dates are flexible {answers.flexibleDates === 'yes' && <b>✓</b>}</button></Card>
      <Card number="02" title="How long would you like the trip to be?"><ChoiceGroup id="tripLength" options={tripLength} /></Card>
      <Card number="03" title="Who are you travelling with?"><ChoiceGroup id="companions" options={companions} /></Card>
      <div className="question-pair"><Card number="04" title="How many people are in your group?"><input className="question-input short-input" type="number" min="1" max="60" value={(answers.groupSize as string) ?? ''} onChange={(event) => update('groupSize', event.target.value)} placeholder="e.g. 4" /></Card><Card number="05" title="What age groups are travelling?" helper="Select all that apply."><ChoiceGroup id="ageGroups" options={ages} multi /></Card></div>
      <Card number="06" title="Where would you like to go?"><ChoiceGroup id="destinationScope" options={destinationScope} /></Card>
      <Card number="07" title="Do you already have a destination in mind?" helper="Optional · Start typing to filter the country list, or add a specific place."><div className="country-picker"><input className="question-input" value={(answers.destination as string) ?? ''} onFocus={() => setCountryListOpen(true)} onBlur={() => window.setTimeout(() => setCountryListOpen(false), 120)} onChange={(event) => { update('destination', event.target.value); setCountryListOpen(true) }} placeholder="Type a country or a specific place..." aria-expanded={countryListOpen} aria-controls="country-suggestions" />{countryListOpen && <div className="country-suggestion-list" id="country-suggestions" role="listbox">{countries.filter((country) => country.toLowerCase().includes(((answers.destination as string) ?? '').toLowerCase())).map((country) => <button type="button" role="option" key={country} onMouseDown={(event) => event.preventDefault()} onClick={() => { update('destination', country); setCountryListOpen(false) }}>{country}</button>)}{!countries.some((country) => country.toLowerCase().includes(((answers.destination as string) ?? '').toLowerCase())) && <p>No country found — you can still add a specific destination.</p>}</div>}</div></Card>
    </div>

    <SectionLabel number="02" title="Budget & stay style" subtitle="Choose what feels comfortable" />
    <div className="question-list"><Card number="08" title="What is your preferred budget per person for the full trip?" helper="Your local currency will be shown automatically."><ChoiceGroup id="budget" options={budgets} /></Card><Card number="09" title="What kind of stay feels right for this trip?" helper="Choose as many as you like."><ChoiceGroup id="stayStyle" options={stays} multi /></Card></div>

    <SectionLabel number="03" title="Your quest DNA" subtitle="The details that make a trip memorable" />
    <div className="question-list"><Card number="10" title="What do you want this trip to feel like?" helper="Choose up to three."><ChoiceGroup id="tripFeeling" options={feelings} multi limit={3} /></Card><Card number="11" title="What pace do you enjoy while travelling?"><ChoiceGroup id="pace" options={pace} /></Card><Card number="12" title="How do you like to discover a destination?"><ChoiceGroup id="discovery" options={discovery} /></Card><Card number="13" title="What matters most to you on this trip?" helper="Give your five priority tokens to the things you care about most." className="priority-card"><div className="token-status"><span>{(answers.priorities as string[] | undefined)?.length ?? 0} / 5 tokens placed</span><div>{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < ((answers.priorities as string[] | undefined)?.length ?? 0) ? 'filled' : ''}>✦</i>)}</div></div><ChoiceGroup id="priorities" options={priorities} multi limit={5} /></Card></div>

    <PreferenceNudge answers={answers} />
    <SectionLabel number="04" title="The perfect-trip details" subtitle="A little context goes a long way" />
    <div className="question-list final-questions"><Card number="14" title="Must-have" helper="What is one thing that would make this trip feel perfect?"><textarea className="question-input" rows={3} value={(answers.mustHave as string) ?? ''} onChange={(event) => update('mustHave', event.target.value)} placeholder="Try local street food, see a sunset, go hiking, spend time near the beach..." /></Card><Card number="15" title="Nice-to-have" helper="What activities would you enjoy if they fit the plan? Optional"><textarea className="question-input" rows={3} value={(answers.niceToHave as string) ?? ''} onChange={(event) => update('niceToHave', event.target.value)} placeholder="A cooking class, live music, a scenic train ride..." /></Card><Card number="16" title="No-go" helper="Anything you would prefer to avoid?"><textarea className="question-input" rows={3} value={(answers.noGo as string) ?? ''} onChange={(event) => update('noGo', event.target.value)} placeholder="Long drives, very early mornings, crowded places..." /></Card></div>
    {saveError && <p className="form-error" role="alert">{saveError}</p>}
    <button className="primary-button form-submit preference-submit" type="button" onClick={complete} disabled={isSaving}>{isSaving ? 'Saving your quest…' : <>Save my preferences <span>→</span></>}</button>
  </section>
}

function SectionLabel({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <div className="form-section-label"><span>{number}</span><div><p>{title}</p><small>{subtitle}</small></div></div> }

function Card({ number, title, helper, children, className = '' }: { number: string; title: string; helper?: string; children: ReactNode; className?: string }) {
  return <section className={`question-card ${className}`}><h2 className="question-title"><span>{number}</span>{title}</h2>{helper && <p className="question-helper">{helper}</p>}{children}</section>
}
