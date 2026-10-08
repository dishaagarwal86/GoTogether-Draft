export function PlacePhotoCaption({ description }: { description: string }) {
  return description ? <div className="place-photo-caption"><small>{description}</small></div> : null
}
