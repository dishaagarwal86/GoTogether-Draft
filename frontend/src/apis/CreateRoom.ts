export function validateTravelDna(travelDnaName: string, email: string) {
  return travelDnaName.trim() && email.trim() ? '' : 'Add a quest name and at least one email to continue.'
}
