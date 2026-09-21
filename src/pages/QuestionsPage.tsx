import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { updateAnswer } from '../apis/Questions'
import { questions } from '../data/Questions'

export function QuestionsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const roomName = location.state?.roomName ?? 'Your new room'
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const update = (id: string, value: string) => setAnswers((current) => updateAnswer(current, id, value))
  const complete = () => navigate('/room/overview', { state: { roomName, answers } })

  return (
    <section className="flow-page questions-page">
      <div className="flow-topbar"><Link className="back-link" to="/plan">← Back</Link><span className="flow-step">3 / 3</span></div>
      <div className="flow-heading"><p className="eyebrow">{roomName}</p><h1>Tell us what <em>matters.</em></h1><p className="lede">A few details help us shape a trip that works for everyone in the room.</p></div>
      <div className="question-list">
        {questions.filter((question) => question.id !== 'kidsAge' || answers.kids === 'Yes').map((question, index) => <fieldset className="question-card" key={question.id}>
          <legend><span>{String(index + 1).padStart(2, '0')}</span>{question.title}</legend>
          {question.helper && <p className="question-helper">{question.helper}</p>}
          {question.kind === 'options' && <div className="option-grid">{question.options?.map((option) => <button className={answers[question.id] === option ? 'option-button selected' : 'option-button'} type="button" key={option} onClick={() => update(question.id, option)}>{option}{answers[question.id] === option && <b>✓</b>}</button>)}</div>}
          {question.kind === 'text' && <input className="question-input" value={answers[question.id] ?? ''} onChange={(event) => update(question.id, event.target.value)} placeholder="Your answer" />}
          {question.kind === 'date' && <input className="question-input" type="date" value={answers[question.id] ?? ''} onChange={(event) => update(question.id, event.target.value)} />}
          {question.kind === 'number' && <input className="question-input short-input" type="number" min="1" max="60" value={answers[question.id] ?? ''} onChange={(event) => update(question.id, event.target.value)} placeholder="Number of days" />}
        </fieldset>)}
      </div>
      <button className="primary-button form-submit" type="button" onClick={complete}>Submit preferences <span>→</span></button>
    </section>
  )
}
