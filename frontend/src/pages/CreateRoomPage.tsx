import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { saveTravelDna } from '../apis/travelDna'
import { DEPARTURE_CITIES, DESTINATIONS } from '../data/destinations'
import { readStored } from '../services/journeyStorage'
import { TravelModeSwitch } from '../components/TravelModeSwitch'
import { Icon } from '../components/Ui'
import { DetailedCreateRoomPage } from './DetailedCreateRoomPage'
import { PreferenceCards, type PreferenceAnswers } from '../components/MemberPreferences'
import { askCompanion } from '../services/companionApi'

const destinations = ['Santorini', 'Bali', 'Amalfi Coast', 'Kyoto', 'Interlaken', 'Marrakech', 'Barcelona', 'Cappadocia', 'Kerala', 'Reykjavík', 'Queenstown', 'Tulum', 'Hoi An', 'Cape Town', 'Madeira', 'Banff', 'Zanzibar', 'Oaxaca', 'Edinburgh', 'Luang Prabang', 'Palawan', 'Patagonia', 'Ubud', 'Valletta']
const editDistance = (left: string, right: string) => {
  const prior = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row++) {
    let diagonal = prior[0]; prior[0] = row
    for (let column = 1; column <= right.length; column++) {
      const stored = prior[column]
      prior[column] = Math.min(prior[column] + 1, prior[column - 1] + 1, diagonal + Number(left[row - 1] !== right[column - 1]))
      diagonal = stored
    }
  }
  return prior[right.length]
}
const mentions = (message: string, phrase: string) => {
  const words = message.toLowerCase().match(/[a-z]+/g) ?? []
  const target = phrase.toLowerCase()
  const allowedDistance = target.length >= 8 ? 2 : 1
  return words.some(word => word === target || (target.length >= 5 && editDistance(word, target) <= allowedDistance))
}
const moodSignals: Array<{ mood: string; terms: string[] }> = [
  { mood: 'Food & local culture', terms: ['food', 'cafe', 'cafes', 'market', 'markets', 'local gems', 'culture'] },
  { mood: 'Relaxation', terms: ['relaxed', 'relaxation', 'slow', 'peaceful', 'chill'] },
  { mood: 'Nightlife', terms: ['nightlife', 'night life', 'clubs', 'clubbing', 'bars'] },
  { mood: 'Nature', terms: ['nature', 'beach', 'mountains', 'hiking', 'outdoors'] },
  { mood: 'Adventure', terms: ['adventure', 'adventurous', 'thrill', 'trekking'] },
  { mood: 'Wellness', terms: ['wellness', 'spa', 'yoga'] },
]

export function CreateRoomPage() {
  const [params] = useSearchParams()
  return params.get('details') === '1' ? <DetailedCreateRoomPage /> : <QuickStart />
}
function QuickStart() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const place = params.get('destination')?.slice(0, 100) ?? ''
  const duration = Number(params.get('days'))
  const key = `gotogether.new-quest-preferences.${user!.id}`
  const [solo, setSolo] = useState(false)
  const [questName, setQuestName] = useState(place ? `Our ${place} chapter` : '')
  const [inviteEmail, setInviteEmail] = useState('')
  const [answers, setAnswers] = useState<PreferenceAnswers>(() => readStored(key, {
    tripLength: `${Number.isInteger(duration) && duration >= 1 && duration <= 30 ? duration : 4} days`, flexibleDates: 'yes', budget: 'Flexible', tripFeeling: [], pace: '', destination: place, travellingFrom: '', stayStyle: [], mustHave: '', niceToHave: '', noGo: '', companions: 'friends', groupSize: '2', personalizationEnabled: 'yes',
  }))
  const [aiPatch, setAiPatch] = useState<Partial<PreferenceAnswers>>({})
  const [aiDraft, setAiDraft] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [covered, setCovered] = useState<string[]>([])
  const [messages, setMessages] = useState<Array<{ role: 'guide' | 'you'; text: string }>>([{ role: 'guide', text: 'Tell me what you know. I’ll help capture dates, destination, budget, pace, stay style, must-dos, and anything you would rather avoid. You can answer in any order.' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const orderedTopics = ['dates', 'duration', 'budget', 'destination', 'departure', 'group', 'moods', 'pace', 'stay', 'must-have', 'no-go']
  const topicPrompt: Record<string, string> = { dates: 'Are your dates flexible, or do you have a date window in mind?', duration: 'How long would you like the trip to be?', budget: 'What budget feels comfortable: budget-friendly, moderate, premium, or open?', destination: 'Is there a destination in mind, or are you open to ideas?', departure: 'Where will you be travelling from?', group: 'Who is travelling, and roughly how many people?', moods: 'What would make this trip feel worth it—food, nature, relaxation, adventure, culture, or something else?', pace: 'Would you prefer slow and relaxed, a balanced mix, or a busy itinerary?', stay: 'What kind of stay would you enjoy: hotel, apartment, villa, or resort?', 'must-have': 'What is one thing you would love to do?', 'no-go': 'Anything you would rather avoid?' }
  const nextPrompt = (topics = covered) => topicPrompt[orderedTopics.find(topic => !topics.includes(topic)) ?? ''] ?? 'That covers the essentials. Review the form on the left, then save your preferences when they feel right.'
  const detectPatch = (message: string, extracted?: { moods?: string[]; budget?: string; pace?: string; mustHave?: string; noGo?: string; daysCount?: number }) => {
    const lower = message.toLowerCase()
    const patch: Partial<PreferenceAnswers> = {}
    const topics: string[] = []
    if (extracted?.daysCount) { patch.tripLength = `${extracted.daysCount} days`; topics.push('duration') }
    if (extracted?.budget) { patch.budget = extracted.budget; topics.push('budget') }
    if (extracted?.pace) { patch.pace = extracted.pace; topics.push('pace') }
    const inferredMoods = moodSignals.filter(({ terms }) => terms.some(term => term.includes(' ') ? lower.includes(term) : mentions(lower, term))).map(({ mood }) => mood)
    const extractedMoods = extracted?.moods?.map(mood => mood === 'Food & Culture' ? 'Food & local culture' : mood) ?? []
    const moods = [...new Set([...extractedMoods, ...inferredMoods])].slice(0, 3)
    if (moods.length) { patch.tripFeeling = moods; topics.push('moods') }
    if (extracted?.mustHave) { patch.mustHave = extracted.mustHave; topics.push('must-have') }
    if (extracted?.noGo) { patch.noGo = extracted.noGo; topics.push('no-go') }
    const departureAliases: Record<string, string> = { bangalore: 'Bengaluru, India', bengaluru: 'Bengaluru, India' }
    const departures = DEPARTURE_CITIES.filter(item => lower.includes(item.toLowerCase()) || mentions(lower, item.split(',')[0].trim()))
    for (const [alias, city] of Object.entries(departureAliases)) if (mentions(lower, alias) && !departures.includes(city)) departures.push(city)
    if (departures.length) { patch.travellingFrom = departures.join(' · '); topics.push('departure') }
    const departureNames = new Set(departures.map(item => item.split(',')[0].trim().toLowerCase()))
    const destination = [...destinations, ...DESTINATIONS].find(item => {
      const names = item.toLowerCase().split(',').map(part => part.trim())
      return !names.some(name => departureNames.has(name)) && (lower.includes(item.toLowerCase()) || names.some(name => mentions(lower, name)))
    })
    if (destination) { patch.destination = destination; topics.push('destination') }
    if (mentions(lower, 'flexible') || /anys+date|whenever|nos+fixeds+date/.test(lower)) { patch.flexibleDates = 'yes'; topics.push('dates') }
    else if (/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|\b\d{1,2}[/-]\d{1,2}/.test(lower)) topics.push('dates')
    const people = lower.match(/\b(\d{1,2})\s*(?:people|travellers|travelers|friends|adults)\b/)
    if (people) { patch.groupSize = people[1]; patch.companions = Number(people[1]) === 1 ? 'solo' : 'friends'; topics.push('group') }
    else if (/justs+me|solo/.test(lower)) { patch.groupSize = '1'; patch.companions = 'solo'; topics.push('group') }
    const stays = ['hotel', 'apartment', 'villa', 'resort'].filter(stay => lower.includes(stay))
    if (stays.length) { patch.stayStyle = stays; topics.push('stay') }
    if (!patch.mustHave && /cafe|cafes|local gems|hidden gems/.test(lower)) { patch.mustHave = 'Cafés and local gems'; topics.push('must-have') }
    if (/^(?:no|nope|nah|none|nothing|no\s+nothing|not\s+really|no\s+thanks)[.!\s]*$/i.test(message.trim()) || /nothing\s+(?:in particular|to avoid)|no\s+(?:restrictions|deal.?breakers)/i.test(lower)) {
      patch.noGo = 'No specific restrictions'; topics.push('no-go')
    } else {
      const noGo = message.match(/\b(?:avoid|skip|without|no|not\s+a\s+fan\s+of|can(?:not|'t)|do\s+not\s+want|don'?t\s+want|hate)\s+[^.!?;\n]+/i)?.[0]
      if (noGo && !/^no\s+(?:problem|worries)/i.test(noGo)) { patch.noGo = noGo; topics.push('no-go') }
    }
    return { patch, topics }
  }
  const askGuide = async () => {
    const message = aiDraft.trim()
    if (!message || aiBusy) return
    setAiBusy(true); setAiError(''); setAiDraft(''); setMessages(current => [...current, { role: 'you', text: message }])
    // Capture clear replies locally first. This keeps simple answers such as
    // “nope” reliable even if the optional AI request is unavailable.
    const local = detectPatch(message)
    const applyGuideResult = (found: ReturnType<typeof detectPatch>) => {
      if (Object.keys(found.patch).length) setAiPatch(found.patch)
      const nextTopics = [...new Set([...covered, ...found.topics])]
      setCovered(nextTopics)
      const labels: Record<string, string> = { dates: 'date flexibility', duration: 'trip length', budget: 'budget', destination: 'destination', departure: 'departure cities', group: 'group', moods: 'travel mood', pace: 'pace', stay: 'stay style', 'must-have': 'must-have', 'no-go': 'no-go preference' }
      const captured = found.topics.map(topic => labels[topic]).filter(Boolean)
      const summary = captured.length ? `Got it — I added ${captured.join(', ')} to your form. ${nextPrompt(nextTopics)}` : `I couldn’t confidently map that to a form field yet. ${nextPrompt(nextTopics)}`
      setMessages(current => [...current, { role: 'guide', text: summary }])
    }
    try {
      const reply = await askCompanion({ task: 'extract', message })
      const remote = detectPatch(message, reply.extracted)
      // A clear local signal takes precedence over a vague remote extraction.
      applyGuideResult({ patch: { ...remote.patch, ...local.patch }, topics: [...new Set([...remote.topics, ...local.topics])] })
    } catch (reason) {
      if (local.topics.length) applyGuideResult(local)
      else setAiError(reason instanceof Error ? reason.message : 'The guide could not respond just now. You can keep using the form.')
    } finally { setAiBusy(false) }
  }
  const begin = async (finalAnswers: PreferenceAnswers) => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const saved = await saveTravelDna(questName.trim() || (typeof finalAnswers.destination === 'string' && finalAnswers.destination ? `Our ${finalAnswers.destination} chapter` : solo ? 'My next escape' : 'Our next escape'), { ...finalAnswers, groupSize: solo ? '1' : String(finalAnswers.groupSize || '2'), companions: solo ? 'solo' : String(finalAnswers.companions || 'friends') }, inviteEmail.trim() || undefined, { submitted: true, homeCountry: user!.country })
      try { localStorage.removeItem(key) } catch { /* A completed draft does not block navigation. */ }
      navigate(`/quests/${saved.roomId}?tab=crew`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not save your preferences. They are still here.') }
    finally { setBusy(false) }
  }
  return <section className="quest-starter"><div className="quest-starter-top"><Link to="/trips">← Your quests</Link><p>START A SHARED QUEST</p></div><header className="quest-starter-heading"><p className="eyebrow">A GOOD TRIP STARTS WITH EVERYONE’S POINT OF VIEW</p><h1>Make space for a<br /><em>great idea.</em></h1><p>Use the form, talk it through with the guide, or move between both. They always stay in sync.</p></header><div className="quest-starter-layout"><section className="quest-starter-form"><div className="quest-starter-form-top"><div><p className="eyebrow">YOUR QUEST</p><h2>Start with your travel style.</h2></div><TravelModeSwitch solo={solo} busy={busy} onChange={mode => { setSolo(mode === 'solo'); setAiPatch({ groupSize: mode === 'solo' ? '1' : String(Math.max(2, Number(answers.groupSize) || 2)), companions: mode === 'solo' ? 'solo' : 'friends' }) }} /></div><div className="quest-starter-meta"><label>Quest name<input value={questName} onChange={event => setQuestName(event.target.value)} placeholder="The long-overdue getaway" maxLength={100} /></label>{!solo && <label>Invite someone now <span>Optional</span><input type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="friend@example.com" /></label>}</div><PreferenceCards initial={answers} externalAnswers={aiPatch} onAnswersChange={setAnswers} storageKey={key} onCancel={() => navigate('/trips')} onSave={begin} />{error && <p className="form-error" role="alert">{error}</p>}</section><aside className="quest-starter-ai" aria-label="AI preference guide"><div className="quest-starter-ai-heading"><span><Icon name="spark" size={18} /></span><div><p className="eyebrow">QUEST GUIDE</p><h2>Talk it through.</h2></div></div><p className="quest-starter-ai-intro">Share your ideas naturally. The guide only fills details you have clearly mentioned; you can review every field in the form.</p><div className="quest-starter-checklist">{orderedTopics.map(topic => <span className={covered.includes(topic) ? 'is-covered' : ''} key={topic}><Icon name={covered.includes(topic) ? 'check' : 'spark'} size={13} />{topic}</span>)}</div><div className="quest-starter-chat" aria-live="polite">{messages.map((message, index) => <p className={message.role} key={`${message.role}-${index}`}>{message.text}</p>)}{aiBusy && <p className="guide is-thinking">Listening for the details that matter…</p>}</div>{aiError && <p className="form-error" role="alert">{aiError}</p>}<form className="quest-starter-composer" onSubmit={event => { event.preventDefault(); void askGuide() }}><label className="sr-only" htmlFor="quest-guide-message">Tell the guide about your trip</label><textarea id="quest-guide-message" value={aiDraft} onChange={event => setAiDraft(event.target.value)} placeholder="We are four friends leaving from Mumbai. We have four relaxed days, love food markets, and want an apartment…" rows={4} maxLength={1600} disabled={aiBusy || busy} /><button className="primary-button" type="submit" disabled={!aiDraft.trim() || aiBusy || busy}>{aiBusy ? 'Thinking…' : 'Add to my preferences'} <Icon name="arrow" size={17} /></button></form><p className="quest-starter-ai-note"><Icon name="lock" size={14} />Nothing is saved or changed without your final confirmation.</p></aside></div>
  </section>
}
