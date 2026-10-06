import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { inviteToQuest, type Quest } from '../apis/quests'
import { useQuests } from '../hooks/useQuests'
import { useQuestRecommendations } from '../hooks/useQuestRecommendations'
import { EmptyState, ErrorState, Icon, LoadingState } from '../components/Ui'
import { RecommendationCards } from '../components/RecommendationCards'
import { QuestChat } from '../components/QuestChat'
import type { ChatContext } from '../components/ItineraryStory'

export function QuestDetailPage() {
  const { roomId = '' } = useParams()
  const { quests, loading, error, retry } = useQuests()
  const quest = quests.find((item) => item.id === roomId)
  if (loading) return <LoadingState label="Opening your quest…" />
  if (error) return <ErrorState message={error} retry={retry} />
  if (!quest) return <EmptyState title="This quest isn’t in your travel book." description="It may be unavailable, or you may need to accept an invitation first." to="/trips" label="Back to my quests" />
  return <QuestWorkspace key={roomId} quest={quest} />
}

function QuestWorkspace({ quest }: { quest: Quest }) {
  const roomId = quest.id
  const location = useLocation()
  const { data, error, retry } = useQuestRecommendations(roomId)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(location.hash === '#crew-chat')
  const [focusRequest, setFocusRequest] = useState(location.hash === '#crew-chat' ? 1 : 0)
  const [chatContext, setChatContext] = useState<ChatContext | null>(location.state?.chatContext ?? null)
  const [unread, setUnread] = useState(0)
  const itinerary = useRef<HTMLElement>(null)
  const workspace = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const grid = workspace.current
    if (!grid) return
    let frame = 0
    const measure = () => {
      const top = Math.max(106, grid.getBoundingClientRect().top + window.scrollY)
      grid.style.setProperty('--quest-chat-start', `${top}px`)
    }
    measure()
    const resize = new ResizeObserver(() => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(measure) })
    resize.observe(grid.parentElement!)
    window.addEventListener('resize', measure)
    return () => { resize.disconnect(); window.cancelAnimationFrame(frame); window.removeEventListener('resize', measure) }
  }, [])
  const openChat = () => { setChatOpen(true); setFocusRequest((value) => value + 1) }
  const discuss = (context: ChatContext) => { setChatContext(context); openChat() }
  return <section className="quest-workspace-page">
    <div className="quest-workspace-breadcrumb"><Link className="back-link" to="/trips">← All your quests</Link><span>A little less someday. A little more together.</span></div>
    {location.state?.saved && <div className="quest-success" role="status"><Icon name="check" size={19} />Your preferences are saved. Let’s make something good of them.</div>}
    {location.state?.invitation?.delivered === false && <p className="form-error" role="status">Your quest is saved, but the invitation email couldn’t be delivered. Use “Invite your people” to try again.</p>}
    <header className="quest-workspace-header"><div><p className="eyebrow">YOUR SHARED TRAVEL BOOK</p><h1>{quest.name}</h1><div className="quest-workspace-meta"><span><Icon name="pin" size={14} />{quest.tripName === quest.name ? 'Somewhere good, still to be found' : `On your mind: ${quest.tripName}`}</span><span><Icon name="people" size={14} />{quest.members} planned {quest.members === 1 ? 'traveller' : 'travellers'}</span><span className="quest-role-tag">{quest.role === 'owner' ? 'You’re hosting' : 'Part of the crew'}</span></div></div><div className="quest-workspace-actions"><button type="button" className="primary-button" onClick={() => setInviteOpen(true)}><Icon name="plus" size={16} />Invite your people</button><button type="button" className="text-button quest-chat-shortcut" onClick={openChat}><Icon name="chat" size={16} />Crew chat{unread > 0 && <span className="quest-unread-count">{unread}</span>}</button></div></header>
    <div className="quest-workspace-grid" ref={workspace}>
      <section className="quest-planning-column" id="quest-itinerary" ref={itinerary} tabIndex={-1} aria-label="Itinerary planning">
        <nav className="quest-planning-links" aria-label="Quest planning"><span><Icon name="compass" size={17} />Itinerary ideas</span><Link to={`/travel-dna/group-dna?roomId=${roomId}`}><Icon name="spark" size={15} />Our Travel DNA</Link><Link to={`/travel-dna/preferences?roomId=${roomId}`}>My travel preferences <Icon name="northeast" size={14} /></Link></nav>
        <div className="quest-ideas-heading"><div><p className="eyebrow">THE WORLD IS STILL OPEN</p><h2>Which way <em>shall we go?</em></h2></div>{data && <p>{data.results.length} starting {data.results.length === 1 ? 'point' : 'points'}<br /><span>Explore one, then talk it over.</span></p>}</div>
        {error ? <ErrorState message={error} retry={retry} /> : !data ? <LoadingState label="Gathering ideas for your crew…" /> : data.results.length ? <RecommendationCards results={data.results} roomId={roomId} travelDna={data.travelDna} workspace onDiscuss={discuss} /> : <EmptyState title="Your ideas are still taking shape." description="Share your travel style to find a starting point, and keep dreaming with your crew in the meantime." to={`/travel-dna/preferences?roomId=${roomId}`} label="Share my travel style" icon="spark" />}
      </section>
      <QuestChat roomId={roomId} open={chatOpen} onClose={() => setChatOpen(false)} focusRequest={focusRequest} context={chatContext} onClearContext={(context) => setChatContext((current) => current === context ? null : current)} onUnreadChange={setUnread} />
    </div>
    <nav className="quest-mobile-dock" aria-label="Quest workspace"><button type="button" onClick={() => { itinerary.current?.scrollIntoView({ block: 'start' }); itinerary.current?.focus({ preventScroll: true }) }}><Icon name="compass" size={19} /><span>The itinerary</span></button><button type="button" className="quest-dock-chat" onClick={openChat} aria-haspopup="dialog" aria-expanded={chatOpen}><Icon name="chat" size={20} /><span>Crew chat</span>{unread > 0 ? <span className="quest-unread-count">{unread}</span> : <Icon name="arrow" size={17} />}</button></nav>
    <QuestInviteDialog roomId={roomId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
  </section>
}

function QuestInviteDialog({ roomId, open, onClose }: { roomId: string; open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    const element = dialog.current
    element?.showModal(); document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }) }
  }, [open])
  const invite = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { const result = await inviteToQuest(roomId, email.trim()); setNotice(result.delivered ? `An invitation is on its way to ${result.email}.` : 'The invitation was saved, but the email could not be delivered. Please try sending it again later.'); if (result.delivered) setEmail('') }
    catch { setError('We couldn’t send the invitation. Please check the address and try again.') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="quest-invite-dialog" aria-labelledby="quest-invite-title" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}><button type="button" className="quest-invite-close" onClick={onClose} aria-label="Close invitation"><Icon name="close" /></button><span className="account-symbol"><Icon name="people" size={27} /></span><p className="eyebrow">THE GOOD PART IS THE TOGETHER PART</p><h2 id="quest-invite-title">Room for your people.</h2><p>Invite a friend to join this quest, share their travel style, and join the conversation.</p><form className="quest-invite-form" onSubmit={invite}><label htmlFor="invite-email">Their email address<input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="friend@example.com" required /></label>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="invite-success" role="status">{notice}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Sending their invitation…' : 'Invite to our quest'}<Icon /></button></form></dialog>
}
