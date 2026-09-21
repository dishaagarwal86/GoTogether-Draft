export function validateNewRoom(roomName: string, email: string) {
  return roomName.trim() && email.trim() ? '' : 'Add a room name and at least one email to continue.'
}
