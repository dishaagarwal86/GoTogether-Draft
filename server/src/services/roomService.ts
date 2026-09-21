import type { CreateRoomInput, Room } from '../models/room.js'

const rooms: Room[] = [
  { id: 'room_1', name: 'Office friends', tripName: 'Kyoto autumn escape', members: 4, createdAt: '2026-09-01T00:00:00.000Z' },
  { id: 'room_2', name: 'School friends', tripName: 'Lisbon long weekend', members: 2, createdAt: '2026-09-05T00:00:00.000Z' },
]

export function listRooms() {
  return rooms
}

export function createRoom(input: CreateRoomInput): Room {
  const room: Room = {
    id: `room_${crypto.randomUUID()}`,
    name: input.name.trim(),
    tripName: input.tripName.trim(),
    members: input.members ?? 1,
    createdAt: new Date().toISOString(),
  }
  rooms.unshift(room)
  return room
}
