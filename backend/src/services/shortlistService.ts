import { randomUUID } from 'node:crypto'
import { insertRow, selectRows, updateRows, upsertRow } from '../storage.js'

type PickType = 'flight' | 'stay' | 'activity' | 'itinerary'
type Reaction = 'love' | 'works' | 'not_for_me'
type Person = { user_id: string; first_name: string | null; last_name: string | null; invite_status: string }
type PickRow = { id: string; trip_room_id: string; user_id: string; type: PickType; title: string; destination: string | null; estimated_price: number | string | null; note: string | null; link: string | null; image_url: string | null; source_data: Record<string, unknown>; shared_at: Date | string | null; created_at: Date | string }
type SharedRow = Omit<PickRow, 'user_id' | 'shared_at'> & { pick_id: string | null; shared_by_user_id: string }
type ReactionRow = { id: string; shared_pick_id: string; user_id: string; reaction: Reaction; note: string | null }
const pickColumns = ['id', 'trip_room_id', 'user_id', 'type', 'title', 'destination', 'estimated_price', 'note', 'link', 'image_url', 'source_data', 'shared_at', 'created_at']
const sharedColumns = ['id', 'pick_id', 'trip_room_id', 'shared_by_user_id', 'type', 'title', 'destination', 'estimated_price', 'note', 'link', 'image_url', 'source_data', 'created_at']

const name = (person?: Pick<Person, 'first_name' | 'last_name'>) => `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim() || 'A traveller'
const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : String(value)
const money = (value: number | string | null) => value == null ? null : Number(value)

async function members(roomId: string) {
  const memberships = await selectRows<{ user_id: string; invite_status: string }>('trip_room_people', ['user_id', 'invite_status'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }])
  const accepted = memberships.filter((member) => member.invite_status === 'accepted')
  const people = accepted.length ? await selectRows<{ id: string; first_name: string | null; last_name: string | null }>('users', ['id', 'first_name', 'last_name'], [{ column: 'id', operator: 'in', value: accepted.map((member) => member.user_id) }]) : []
  const peopleById = new Map(people.map((person) => [person.id, person]))
  return accepted.map((member) => ({ ...member, ...peopleById.get(member.user_id), displayName: name(peopleById.get(member.user_id)) }))
}
async function assertMember(roomId: string, userId: string) {
  const [membership] = await selectRows('trip_room_people', ['id'], [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'user_id', operator: 'eq', value: userId }, { column: 'invite_status', operator: 'eq', value: 'accepted' }])
  if (!membership) throw new Error('Only accepted quest members can update the shortlist.')
}
function statusFor(reactions: ReactionRow[], memberCount: number) {
  const responseCount = reactions.length
  const loveCount = reactions.filter((reaction) => reaction.reaction === 'love').length
  const worksCount = reactions.filter((reaction) => reaction.reaction === 'works').length
  const notForMeCount = reactions.filter((reaction) => reaction.reaction === 'not_for_me').length
  const missingResponses = Math.max(0, memberCount - responseCount)
  const hardConflict = notForMeCount > 0
  const status = responseCount < Math.ceil(memberCount / 2) ? 'waiting' : hardConflict || missingResponses > 1 ? 'needs_alignment' : responseCount === memberCount ? 'aligned' : 'nearly_aligned'
  return { responseCount, loveCount, worksCount, notForMeCount, missingResponses, hardConflict, status }
}
function validateInput(input: Record<string, unknown>) {
  const type = input.type
  if (!['flight', 'stay', 'activity', 'itinerary'].includes(String(type))) throw new Error('Choose what kind of pick this is.')
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title || title.length > 180) throw new Error('Give this pick a short title.')
  const price = input.estimatedPrice == null || input.estimatedPrice === '' ? null : Number(input.estimatedPrice)
  if (price != null && (!Number.isFinite(price) || price < 0)) throw new Error('Estimated price must be a positive number.')
  const link = typeof input.link === 'string' ? input.link.trim().slice(0, 1000) : ''
  if (link) { try { if (!/^https?:$/.test(new URL(link).protocol)) throw new Error() } catch { throw new Error('Optional links must start with http:// or https://.') } }
  return { type: type as PickType, title, destination: typeof input.destination === 'string' ? input.destination.trim() || null : null, estimated_price: price, note: typeof input.note === 'string' ? input.note.trim().slice(0, 600) || null : null, link: link || null, image_url: typeof input.imageUrl === 'string' ? input.imageUrl.trim().slice(0, 1000) || null : null }
}

export async function getShortlist(roomId: string, userId: string) {
  await assertMember(roomId, userId)
  const roomMembers = await members(roomId)
  const [privateRows, sharedRows] = await Promise.all([
    selectRows<PickRow>('quest_picks', pickColumns, [{ column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'user_id', operator: 'eq', value: userId }], { orderBy: 'created_at' }),
    selectRows<SharedRow>('quest_shared_picks', sharedColumns, [{ column: 'trip_room_id', operator: 'eq', value: roomId }], { orderBy: 'created_at' }),
  ])
  const reactions = sharedRows.length ? await selectRows<ReactionRow>('quest_pick_reactions', ['id', 'shared_pick_id', 'user_id', 'reaction', 'note'], [{ column: 'shared_pick_id', operator: 'in', value: sharedRows.map((row) => row.id) }]) : []
  const people = new Map(roomMembers.map((person) => [person.user_id, person]))
  const formatShared = (row: SharedRow) => {
    const itemReactions = reactions.filter((reaction) => reaction.shared_pick_id === row.id)
    const byUser = new Map(itemReactions.map((reaction) => [reaction.user_id, reaction]))
    return { id: row.id, type: row.type, title: row.title, destination: row.destination, estimatedPrice: money(row.estimated_price), note: row.note, link: row.link, imageUrl: row.image_url, sourceData: row.source_data ?? {}, createdAt: iso(row.created_at), addedBy: { id: row.shared_by_user_id, name: people.get(row.shared_by_user_id)?.displayName ?? 'A traveller' }, groupFit: statusFor(itemReactions, roomMembers.length), reactions: roomMembers.map((person) => ({ userId: person.user_id, name: person.displayName, reaction: byUser.get(person.user_id)?.reaction ?? null, note: byUser.get(person.user_id)?.note ?? null, isMe: person.user_id === userId })) }
  }
  const sharedIds = new Set(sharedRows.map((row) => row.pick_id).filter(Boolean))
  return {
    myPicks: privateRows.map((row) => ({ id: row.id, type: row.type, title: row.title, destination: row.destination, estimatedPrice: money(row.estimated_price), note: row.note, link: row.link, imageUrl: row.image_url, createdAt: iso(row.created_at), shared: Boolean(row.shared_at) || sharedIds.has(row.id) })),
    sharedShortlist: sharedRows.map(formatShared),
    members: roomMembers.map((person) => ({ id: person.user_id, name: person.displayName })),
  }
}

export async function createPick(roomId: string, userId: string, input: Record<string, unknown>) {
  await assertMember(roomId, userId)
  const data = validateInput(input)
  const row = await insertRow<PickRow>('quest_picks', { id: `pick_${randomUUID()}`, trip_room_id: roomId, user_id: userId, ...data, source_data: {} }, pickColumns)
  return { id: row.id }
}

export async function sharePick(roomId: string, userId: string, pickId: string) {
  await assertMember(roomId, userId)
  const [pick] = await selectRows<PickRow>('quest_picks', pickColumns, [{ column: 'id', operator: 'eq', value: pickId }, { column: 'trip_room_id', operator: 'eq', value: roomId }, { column: 'user_id', operator: 'eq', value: userId }])
  if (!pick) throw new Error('That pick is no longer available.')
  const [existing] = await selectRows('quest_shared_picks', ['id'], [{ column: 'pick_id', operator: 'eq', value: pickId }])
  if (!existing) await insertRow('quest_shared_picks', { id: `shared_pick_${randomUUID()}`, pick_id: pick.id, trip_room_id: roomId, shared_by_user_id: userId, type: pick.type, title: pick.title, destination: pick.destination, estimated_price: pick.estimated_price, note: pick.note, link: pick.link, image_url: pick.image_url, source_data: pick.source_data ?? {} }, ['id'])
  await updateRows('quest_picks', { shared_at: new Date().toISOString(), updated_at: new Date().toISOString() }, [{ column: 'id', operator: 'eq', value: pickId }], ['id'])
}

export async function reactToSharedPick(roomId: string, userId: string, sharedPickId: string, input: Record<string, unknown>) {
  await assertMember(roomId, userId)
  const reaction = input.reaction
  if (!['love', 'works', 'not_for_me'].includes(String(reaction))) throw new Error('Choose a reaction.')
  const note = reaction === 'not_for_me' && typeof input.note === 'string' ? input.note.trim().slice(0, 500) || null : null
  const [shared] = await selectRows('quest_shared_picks', ['id'], [{ column: 'id', operator: 'eq', value: sharedPickId }, { column: 'trip_room_id', operator: 'eq', value: roomId }])
  if (!shared) throw new Error('That shared pick is no longer available.')
  await upsertRow('quest_pick_reactions', { id: `reaction_${randomUUID()}`, shared_pick_id: sharedPickId, user_id: userId, reaction, note, updated_at: new Date().toISOString() }, ['shared_pick_id', 'user_id'])
}
