import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { analyseQuestNotes, applyQuestNote, dismissQuestNote, getQuestMessages, getQuestNotes, sendQuestMessage, setQuestNotesEnabled, type QuestMessage, type QuestNote } from '../apis/quests'
import { useAuth } from '../auth/AuthContext'
import { Icon } from './Ui'
import type { ChatContext } from './ItineraryStory'

type Props = { roomId: string; open: boolean; onClose: () => void; focusRequest: number; context: ChatContext | null; onClearContext: (context: ChatContext) => void; onUnreadChange: (count: number) => void; onQuestNoteApplied?: () => void; embedded?: boolean; solo?: boolean }
const isSmallScreen = () => window.matchMedia('(max-width: 1020px)').matches
function messageDate(value: string) {
  const date = new Date(value)
  return date.toDateString() === new Date().toDateString() ? 'Today' : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}
function QuestNoteCard({ note, busy, showImpact, onImpact, onApply, onDismiss }: { note: QuestNote; busy: boolean; showImpact: boolean; onImpact: () => void; onApply: (note: QuestNote, action: 'must_have' | 'nice_to_have') => void; onDismiss: (note: QuestNote) => void }) {
  return <aside className="quest-note-card" aria-label="Quest Note suggestion"><p className="eyebrow">QUEST NOTE ✦</p><strong>{note.groupSupportCount} {note.groupSupportCount === 1 ? 'person mentioned' : 'people mentioned'} {note.suggestion.toLowerCase().replace(/[.]$/, '')}.</strong><p>Want to add this to your quest? It stays optional until someone chooses an action.</p><div className="quest-note-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => onApply(note, 'must_have')}>Make it a group must-have</button><button type="button" className="secondary-button" disabled={busy} onClick={() => onApply(note, 'nice_to_have')}>Add as a nice-to-have</button><button type="button" className="text-button" onClick={onImpact}>See itinerary impact</button><button type="button" className="text-button" disabled={busy} onClick={() => onDismiss(note)}>Not now</button></div>{showImpact && <p className="quest-note-impact">This updates your shared preferences for future recommendations. Your saved itinerary stays as it is until your host edits it.</p>}</aside>
}
export function QuestChat({ roomId, open, onClose, focusRequest, context, onClearContext, onUnreadChange, onQuestNoteApplied, embedded = false, solo = false }: Props) {
  const { user } = useAuth()
  const [compact, setCompact] = useState(isSmallScreen)
  const [messages, setMessages] = useState<QuestMessage[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const [unread, setUnread] = useState(0)
  const [revision, setRevision] = useState(0)
  const [notesEnabled, setNotesEnabled] = useState(false)
  const [notes, setNotes] = useState<QuestNote[]>([])
  const [privateNote, setPrivateNote] = useState<Pick<QuestNote, 'type' | 'suggestion' | 'proposedAction'> | null>(null)
  const [notesBusy, setNotesBusy] = useState(false)
  const [notesError, setNotesError] = useState('')
  const [impactNoteId, setImpactNoteId] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const thread = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const known = useRef(new Set<string>())
  const initialized = useRef(false)
  const nearBottom = useRef(true)
  const scrollPending = useRef(true)
  const visible = useRef(!compact || open)
  const previousFocusRequest = useRef(0)

  useEffect(() => { const query = window.matchMedia('(max-width: 1020px)'); const update = () => setCompact(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update) }, [])
  useEffect(() => { visible.current = embedded ? open : !compact || open }, [compact, open, embedded])
  useEffect(() => { onUnreadChange(unread) }, [unread, onUnreadChange])
  useEffect(() => { let active = true; getQuestNotes(roomId).then((state) => { if (active) { setNotesEnabled(state.enabled); setNotes(state.notes) } }).catch(() => { if (active) setNotesError('Quest Notes are unavailable until the latest database migration is applied.') }); return () => { active = false } }, [roomId])
  useEffect(() => {
    if (embedded || !compact || !open) { dialog.current?.close(); return }
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    const element = dialog.current
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [compact, open, embedded])

  const scrollLatest = () => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight
    nearBottom.current = true
    scrollPending.current = false
  }
  const toLatest = () => { scrollLatest(); setUnread(0) }
  useLayoutEffect(() => {
    if (visible.current && scrollPending.current) scrollLatest()
  }, [messages, loading])
  useEffect(() => {
    if (compact && !open) return
    const frame = window.requestAnimationFrame(() => {
      toLatest()
      if (focusRequest > previousFocusRequest.current) { composer.current?.focus({ preventScroll: true }); previousFocusRequest.current = focusRequest }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [compact, open, focusRequest])

  useEffect(() => {
    let active = true
    let inFlight = false
    const refresh = async () => {
      if (inFlight || document.hidden) return
      inFlight = true
      try {
        const items = await getQuestMessages(roomId)
        if (!active) return
        const incoming = items.filter((item) => !known.current.has(item.id) && item.senderId !== user!.id)
        items.forEach((item) => known.current.add(item.id))
        const readingLatest = visible.current && !document.hidden && nearBottom.current
        if (!initialized.current || readingLatest) scrollPending.current = true
        else if (incoming.length) setUnread((count) => count + incoming.length)
        initialized.current = true
        setMessages((current) => {
          const merged = new Map([...current, ...items].map((item) => [item.id, item]))
          if (merged.size === current.length) return current
          return [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
        })
        setLoadError('')
      } catch { if (active) setLoadError('The conversation couldn’t refresh. Your messages are still here.') }
      finally { if (active) setLoading(false); inFlight = false }
    }
    void refresh()
    const interval = window.setInterval(refresh, 5000)
    const whenVisible = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', whenVisible)
    return () => { active = false; window.clearInterval(interval); document.removeEventListener('visibilitychange', whenVisible) }
  }, [roomId, user, revision])

  const send = async (event?: FormEvent) => {
    event?.preventDefault()
    if (sending || !text.trim()) return
    const draft = text
    const attached = context
    const body = attached ? `About ${attached.label}\n${attached.detail.slice(0, 380)}\n\n${draft.trim()}` : draft.trim()
    if (body.length > 2000) { setSendError('This message is a little long. Shorten it before sending.'); return }
    setSending(true); setSendError('')
    try {
      const created = await sendQuestMessage(roomId, body)
      known.current.add(created.id)
      scrollPending.current = true
      setMessages((current) => current.some((item) => item.id === created.id) ? current : [...current, created].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)))
      setText((current) => current === draft ? '' : current)
      if (attached) onClearContext(attached)
      nearBottom.current = true
      setUnread(0)
      if (notesEnabled) void findNotes()
    } catch { setSendError('That message didn’t send. Your draft is safe here; try sending it again.') }
    finally { setSending(false); composer.current?.focus({ preventScroll: true }) }
  }
  const toggleNotes = async () => {
    if (notesBusy) return
    setNotesBusy(true); setNotesError('')
    try { const result = await setQuestNotesEnabled(roomId, !notesEnabled); setNotesEnabled(result.enabled); if (result.enabled) await findNotes() }
    catch (error) { setNotesError(error instanceof Error ? error.message : 'Quest Notes could not be updated.') }
    finally { setNotesBusy(false) }
  }
  const findNotes = async () => {
    if (notesBusy) return
    setNotesBusy(true); setNotesError('')
    try { const result = await analyseQuestNotes(roomId); if (result.note) setNotes((current) => current.some((note) => note.id === result.note!.id) ? current : [result.note!, ...current]); if (result.privateSuggestion) setPrivateNote(result.privateSuggestion) }
    catch (error) { setNotesError(error instanceof Error ? error.message : 'Quest Notes could not find a clear shared signal yet.') }
    finally { setNotesBusy(false) }
  }
  const applyNote = async (note: QuestNote, action: 'must_have' | 'nice_to_have') => {
    if (notesBusy) return
    setNotesBusy(true); setNotesError('')
    try { await applyQuestNote(roomId, note.id, action); setNotes((current) => current.filter((item) => item.id !== note.id)); onQuestNoteApplied?.(); setRevision((value) => value + 1) }
    catch (error) { setNotesError(error instanceof Error ? error.message : 'That Quest Note could not be added.') }
    finally { setNotesBusy(false) }
  }
  const dismissNote = async (note: QuestNote) => { if (notesBusy) return; setNotesBusy(true); try { await dismissQuestNote(roomId, note.id); setNotes((current) => current.filter((item) => item.id !== note.id)) } catch { setNotesError('That Quest Note could not be dismissed.') } finally { setNotesBusy(false) } }
  const content = <>
    <header className="crew-panel-heading"><span className="crew-panel-symbol"><Icon name="chat" size={21} /></span><div><p className="eyebrow">{solo ? 'A PLACE FOR YOUR WHAT IFS' : 'BETTER WITH YOUR PEOPLE'}</p><h2 id="crew-chat-title">{solo ? 'Your trip notebook.' : 'The crew conversation.'}</h2></div><button type="button" className="crew-close" aria-label={solo ? 'Close trip notes' : 'Close crew chat'} onClick={onClose} autoFocus={compact}><Icon name="close" size={20} /></button></header>
    <div className="crew-panel-note"><Icon name="people" size={14} /><span>{solo ? 'Notes stay with this trip if you invite others later.' : 'A shared space for this quest.'}</span><label className="quest-notes-toggle"><input type="checkbox" checked={notesEnabled} disabled={notesBusy} onChange={() => void toggleNotes()} /><span>Use chat to suggest quest updates</span></label><small>When enabled, GoTogether analyses only recent chat messages and turns repeated trip ideas into optional planning suggestions.</small></div>
    <div className="crew-message-space">
      <div className="crew-thread" ref={thread} role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions" onScroll={() => { const el = thread.current!; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48; if (nearBottom.current && visible.current) setUnread(0) }}>
        {loading ? <div className="crew-chat-empty"><Icon name="chat" size={30} /><p>Opening your conversation…</p></div> : !messages.length && <div className="crew-chat-empty"><span><Icon name="chat" size={30} /></span><h3>Every good trip starts<br />with a “what if?”</h3><p>Drop an idea, share a must-do, or discuss a day from the itinerary.</p><button type="button" onClick={() => { setText((current) => current || (solo ? 'The one thing I would love to do is…' : 'What’s the one thing everyone would love to do?')); composer.current?.focus() }}>{solo ? 'Start a note' : 'Break the ice'} <Icon size={15} /></button></div>}
        {messages.map((item, index) => <div className="crew-message-group" key={item.id}>{(index === 0 || messageDate(item.createdAt) !== messageDate(messages[index - 1].createdAt)) && <div className="crew-date-divider"><span>{messageDate(item.createdAt)}</span></div>}<article className={`crew-message${item.senderId === user!.id ? ' crew-message-mine' : ''}${item.body.startsWith('Quest Note ✦') ? ' crew-system-message' : ''}`}><header><span className="crew-message-avatar" aria-hidden="true">{item.senderName?.trim().charAt(0) || '?'}</span><strong>{item.body.startsWith('Quest Note ✦') ? 'Quest Note' : item.senderId === user!.id ? 'You' : item.senderName}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></header><p>{item.body}</p></article></div>)}
        {notesEnabled && notes.map((note) => <QuestNoteCard key={note.id} note={note} busy={notesBusy} showImpact={impactNoteId === note.id} onImpact={() => setImpactNoteId((current) => current === note.id ? null : note.id)} onApply={applyNote} onDismiss={dismissNote} />)}
        {notesEnabled && privateNote && <aside className="quest-note-card is-private"><p className="eyebrow">PRIVATE QUEST NOTE ✦</p><strong>{privateNote.suggestion}</strong><p>Only you can see this. {privateNote.proposedAction}</p><button type="button" className="text-button" onClick={() => setPrivateNote(null)}>Not now</button></aside>}
      </div>
      {unread > 0 && <button className="crew-new-messages" type="button" onClick={toLatest}>{unread} new {unread === 1 ? 'message' : 'messages'} ↓</button>}
    </div>
    {(loadError || notesError) && <div className="crew-refresh-error" role="status">{loadError || notesError}<button type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}
    <form className="crew-composer" onSubmit={send}>
      {context && <div className="crew-compose-context"><Icon name="pin" size={16} /><div><strong>{context.label}</strong><span>{context.detail}</span></div><button type="button" aria-label="Remove itinerary context" onClick={() => onClearContext(context)}><Icon name="close" size={15} /></button></div>}
      <label className="sr-only" htmlFor="crew-message">{solo ? 'Add a trip note' : 'Message your crew'}</label><textarea id="crew-message" ref={composer} rows={3} maxLength={context ? 1400 : 2000} value={text} onChange={(event) => { setText(event.target.value); setSendError('') }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void send() } }} placeholder="A place, a thought, a ‘what if we…’" />
      {sendError && <p className="form-error" role="alert">{sendError}</p>}
      <div className="crew-compose-actions"><span>{solo ? 'A little thought for later.' : 'Make room for every voice.'}</span><button className="primary-button" type="submit" disabled={sending || !text.trim()}>{sending ? 'Sending…' : 'Send'}<Icon size={16} /></button></div>
    </form>
  </>
  return compact && !embedded ? <dialog ref={dialog} className="crew-chat-panel crew-chat-dialog" id="crew-chat" aria-labelledby="crew-chat-title" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>{content}</dialog> : <aside className="crew-chat-panel" id="crew-chat" aria-labelledby="crew-chat-title">{content}</aside>
}
