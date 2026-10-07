export function validateTravelDna(travelDnaName: string) {
  return travelDnaName.trim() ? '' : 'Give your quest a name to continue.'
}
