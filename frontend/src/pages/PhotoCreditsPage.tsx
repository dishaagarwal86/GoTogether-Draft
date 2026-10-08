import { Link } from 'react-router-dom'
import records from '../data/placePhotos.json'
import { discoveredPhotoCredits, type Photo } from '../services/activityPhotos'
import '../styles/photo-credits.css'

export function PhotoCreditsPage() {
  const photos: Array<Photo & { name?: string }> = [...records, ...discoveredPhotoCredits()]
  const unique = [...new Map(photos.map(photo => [photo.source, photo])).values()]
  return <section className="photo-credits-page"><Link to="/explore">← Explore places</Link><h1>Photo credits</h1><p>Thank you to the photographers who help bring these places to life. Each source includes the original photograph and its licence. Images are resized and may be cropped to fit the layout.</p><ul>{unique.map(photo => <li key={photo.source}><h2>{photo.name || photo.title || 'Travel photograph'}</h2><p>{photo.author} · {photo.license}</p><a href={photo.source} target="_blank" rel="noreferrer">{photo.title || 'Original photo and licence'}</a>{photo.changes && <p>{photo.changes}</p>}</li>)}</ul></section>
}
