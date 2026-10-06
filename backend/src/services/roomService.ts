import type { CreateRoomInput, Room } from '../models/room.js'
import { selectRows, insertRow, updateRows, upsertRow } from '../storage.js'
import { createTripRoomInvite } from './invitationService.js'

type RoomRow = { id: string; name: string; trip_name: string; members: number; created_at: Date | string }
const roomColumns = ['id', 'name', 'trip_name', 'members', 'created_at']

function map(row: RoomRow): Room {
  return {
    id: String(row.id),
    name: String(row.name),
    tripName: String(row.trip_name),
    members: Number(row.members),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

export async function listRooms() {
  return (await selectRows<RoomRow>('trip_rooms', roomColumns, [], { orderBy: 'created_at' })).map(map)
}

export async function listUserRooms(userId: string) {
  const memberships = await selectRows<{ trip_room_id: string; role: string; invite_status: string }>(
    'trip_room_people', ['trip_room_id', 'role', 'invite_status'],
    [{ column: 'user_id', operator: 'eq', value: userId }], { orderBy: 'created_at' },
  )
  if (!memberships.length) return []
  const rooms = await selectRows<RoomRow>('trip_rooms', roomColumns, [
    { column: 'id', operator: 'in', value: memberships.map((membership) => membership.trip_room_id) },
  ])
  const byId = new Map(rooms.map((room) => [room.id, room]))
  return memberships.flatMap((membership) => {
    const room = byId.get(membership.trip_room_id)
    return room ? [{ ...map(room), role: membership.role, inviteStatus: membership.invite_status }] : []
  })
}

export async function createRoom(input: CreateRoomInput & { inviteEmail?: string; ownerId?: string }) {
  const room = map(await insertRow<RoomRow>('trip_rooms', {
    id: `room_${crypto.randomUUID()}`, name: input.name.trim(), trip_name: input.tripName.trim(), members: input.members ?? 1,
  }, roomColumns))
  if (input.ownerId) {
    await upsertRow('trip_room_people', { trip_room_id: room.id, user_id: input.ownerId, role: 'owner', invite_status: 'accepted' }, ['trip_room_id', 'user_id'])
  }
  const invite = input.inviteEmail?.trim() ? await createTripRoomInvite(room, input.inviteEmail) : undefined
  return { ...room, invite }
}

export async function inviteToRoom(roomId: string, email: string) {
  const [room] = await selectRows<{ id: string; name: string }>('trip_rooms', ['id', 'name'], [{ column: 'id', operator: 'eq', value: roomId }])
  return room ? createTripRoomInvite(room, email) : undefined
}

export async function updateRoom(id: string, input: Partial<CreateRoomInput>) {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.name?.trim()) {
    row.name = input.name.trim()
  }
  if (input.tripName?.trim()) {
    row.trip_name = input.tripName.trim()
  }
  if (typeof input.members === 'number') {
    row.members = input.members
  }

  const rows = await updateRows<RoomRow>('trip_rooms', row, [{ column: 'id', operator: 'eq', value: id }], roomColumns)
  return rows[0] ? map(rows[0]) : undefined
}
