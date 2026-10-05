import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { validateTravelDna } from '../apis/CreateRoom'

export function CreateRoomPage() {
  const navigate = useNavigate()
  const [travelDnaName, setTravelDnaName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validateTravelDna(travelDnaName, email)
    if (validationError) {
      setError(validationError)
      return
    }
    navigate('/travel-dna/preferences', { state: { travelDnaName: travelDnaName.trim(), invitedEmail: email.trim(), tripName: travelDnaName.trim() } })
  }

  return <section className="flow-page form-page"><div className="flow-topbar"><Link className="back-link" to="/plan">← Your quests</Link><span className="flow-step">2 / 3</span></div><div className="flow-heading"><p className="eyebrow">Your quest begins here</p><h1>Name your new <em>quest.</em></h1><p className="lede">Start with the people and preferences that make this escape feel like yours.</p></div><form className="room-form" onSubmit={handleSubmit}><label htmlFor="travel-dna-name">Quest name<input id="travel-dna-name" value={travelDnaName} onChange={(event) => setTravelDnaName(event.target.value)} placeholder="e.g. Japan autumn 2026" /></label><label htmlFor="invite-email">Add your crew <span>email</span><input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="friend@example.com" /></label><p className="form-hint">You can invite more people once your quest is ready.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button form-submit" type="submit">Continue the quest <span>→</span></button></form></section>
}
