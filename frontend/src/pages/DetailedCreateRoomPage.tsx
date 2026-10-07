import { destinationPhotos } from '../data/destinationPhotos'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { TravelModeSwitch } from '../components/TravelModeSwitch'
import { Icon } from '../components/Ui'
import { TravelArtwork } from '../components/TravelArtwork'
import { draftKey, emptyDraft, readStored, writeStored, type QuestDraft } from '../services/journeyStorage'
import { exploreItineraries } from '../data/exploreItineraries'
import { createQuest } from '../apis/quests'
import coast from '../assets/coast-hero.png'

export function DetailedCreateRoomPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const inspiration = exploreItineraries.find((trip) => trip.id === params.get('inspiration'))
  const key = draftKey(user!.id)
  const [draft, setDraft] = useState<QuestDraft>(() => { const saved = readStored(key, emptyDraft); return inspiration && !saved.name ? { ...saved, name: `Our ${inspiration.destination} chapter`, answers: { ...saved.answers, destination: inspiration.destination } } : saved })
  const update = (field: 'name' | 'email', value: string) => { const next = { ...draft, [field]: value }; setDraft(next); writeStored(key, next) }
  const [members, setMembers] = useState('2')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (busy || !draft.name.trim()) return; setBusy(true); setError(''); try { const room = await createQuest(draft.name.trim(), Number(members), members === '1' ? undefined : draft.email.trim() || undefined); writeStored(key, emptyDraft); navigate(`/quests/${room.id}?tab=crew`) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your room could not save.') } finally { setBusy(false) } }

  return <section className="builder-page"><div className="builder-topbar"><Link to="/trips" className="back-link">← Your quests</Link><span>01 <i>/</i> START SOMETHING GOOD</span></div><div className="builder-grid"><div className="builder-copy"><p className="eyebrow">A BIG MEMORY. A SMALL FIRST STEP.</p><h1>Every great trip<br />starts with<br /><em>"what if?"</em></h1><p className="builder-intro">Solo adventure or group trip — give it a name and lets shape it around you.</p><form className="journey-form" onSubmit={submit}><TravelModeSwitch solo={members === '1'} busy={busy} onChange={mode => setMembers(mode === 'solo' ? '1' : '2')} /><label htmlFor="quest-name">What shall we call this quest?<input id="quest-name" value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="The long-overdue getaway" maxLength={100} required autoFocus /></label><div className="name-suggestions"><span>A little inspiration:</span>{['The great escape', 'Just us, somewhere', 'A weekend well spent', 'Solo chapter'].map((name) => <button type="button" onClick={() => update('name', name)} key={name}>{name} ↗</button>)}</div>{members !== '1' && <><label htmlFor="crew-email">Invite someone to join <span className="field-optional">Optional — skip for solo trips</span><input id="crew-email" type="email" value={draft.email} onChange={(event) => update('email', event.target.value)} placeholder="friend@example.com" /></label><p className="input-note"><Icon name="people" size={15} />You can add more people any time after you create the quest.</p><label>Travellers, including you<input type="number" min="1" max="60" value={members} onChange={event => setMembers(event.target.value)} required /></label></>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Creating your room…' : 'Start my quest'} <Icon /></button><p className="draft-note"><Icon name="check" size={14} />Your draft stays in this browser as you go.</p></form></div><aside className="builder-postcard"><TravelArtwork motif="stamp" className="postcard-keepsake-stamp" /><TravelArtwork motif="camera" className="postcard-keepsake-camera" /><img src={inspiration ? destinationPhotos[inspiration.id] ?? inspiration.image : coast} alt="A sunlit coastal village waiting to be explored" /><div><p>{inspiration ? inspiration.destination : 'Somewhere well talk about for years.'}</p><span>Wish we were here. <Icon name="heart" size={18} /></span></div><p className="postcard-footnote">The destination can wait.<br />The good company can’t.</p></aside></div></section>
}
