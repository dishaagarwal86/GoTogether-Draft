import type { CreateRoomInput, Room } from '../models/room.js'
import { selectRows, insertRow, updateRows } from '../storage.js'

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

export async function createRoom(input: CreateRoomInput) {
  return map(await insertRow<RoomRow>('trip_rooms', {
    id: `room_${crypto.randomUUID()}`, name: input.name.trim(), trip_name: input.tripName.trim(), members: input.members ?? 1,
  }, roomColumns))
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
