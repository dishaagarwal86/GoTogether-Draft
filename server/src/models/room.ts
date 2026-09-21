export type Room = {
  id: string
  name: string
  tripName: string
  members: number
  createdAt: string
}

export type CreateRoomInput = Pick<Room, 'name' | 'tripName'> & {
  members?: number
}
