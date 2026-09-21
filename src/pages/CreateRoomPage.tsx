import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { validateNewRoom } from '../apis/CreateRoom'

export function CreateRoomPage() {
  const navigate = useNavigate()
  const [roomName, setRoomName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validateNewRoom(roomName, email)
    if (validationError) {
      setError(validationError)
      return
    }
    navigate('/room/questions', { state: { roomName: roomName.trim(), invitedEmail: email.trim(), tripName: roomName.trim() } })
  }

  return <section className="flow-page form-page"><div className="flow-topbar"><Link className="back-link" to="/plan">← Plan your trip</Link><span className="flow-step">2 / 3</span></div><div className="flow-heading"><p className="eyebrow">A room for your people</p><h1>Create a new <em>room.</em></h1><p className="lede">Start the conversation, then let everyone add what matters to them.</p></div><form className="room-form" onSubmit={handleSubmit}><label htmlFor="room-name">Room name<input id="room-name" value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="e.g. Japan 2025" /></label><label htmlFor="invite-email">Add people <span>email</span><input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="friend@example.com" /></label><p className="form-hint">You can add more people once the room is created.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button form-submit" type="submit">Next <span>→</span></button></form></section>
}
