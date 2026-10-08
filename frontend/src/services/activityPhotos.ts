import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import placeholder from '../assets/travel-placeholder.svg'

export type Photo = { url: string; source: string; author: string; license: string; title?: string; licenseUrl?: string; changes?: string; fullUrl?: string; fullWidth?: number; fullHeight?: number }
// v7 also excludes scientific/specimen images from older search caches.
const cacheKey = 'gotogether.activity-photos.v7'
const safeUrl = (value: unknown, host: string) => {
  try { const url = new URL(String(value)); return url.protocol === 'https:' && url.hostname === host } catch { return false }
}
function validPhoto(value: unknown): value is Photo {
  const photo = value as Photo | null
  return Boolean(photo && (safeUrl(photo.url, 'upload.wikimedia.org') || safeUrl(photo.url, 'thumb.wikimedia.org')) && safeUrl(photo.source, 'commons.wikimedia.org') && typeof photo.author === 'string' && photo.author.length <= 160 && typeof photo.license === 'string' && /^(CC BY|CC0|Public domain)/i.test(photo.license) && [photo.title, photo.licenseUrl, photo.changes].every(value => value == null || typeof value === 'string'))
}
function readCache(): Array<[string, Photo[]]> {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(cacheKey) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    return Object.entries(value).slice(-100).filter(([query, items]) => query.length <= 110 && Array.isArray(items)).map(([query, items]) => [query, (items as unknown[]).filter(validPhoto).slice(0, 4)])
  } catch { return [] }
}
const memory = new Map<string, Photo[]>(readCache())
const pending = new Map<string, Promise<Photo[]>>()
const waiting: Array<() => void> = []
let active = 0
let retryAfter = 0
async function throttled<T>(task: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve))
  active++
  try { return await task() } finally { active--; waiting.shift()?.() }
}
const plain = (value: string, limit = 160) => new DOMParser().parseFromString(value, 'text/html').body.textContent?.trim().slice(0, limit) || ''
const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')
type ImageInfo = { url?: string; thumburl: string; descriptionurl: string; mime: string; mediatype: string; width: number; height: number; extmetadata?: Record<string, { value: string }> }
function relevantPhoto(title: string, info: ImageInfo, query: string) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(info.mime) || info.mediatype !== 'BITMAP' || info.width < 500 || info.height < 300 || info.width / info.height < .7 || info.width / info.height > 3) return false
  const description = normalize(`${title} ${plain(info.extmetadata?.ImageDescription?.value ?? '', 1800)} ${plain(info.extmetadata?.Categories?.value ?? '', 1800)}`)
  if (/\b(newspapers?|newspaperarchive|scans?|scanned|manuscripts?|documents?|book covers?|book pages?|engravings?|lithographs?|illustrations?|advertisements?|posters?|diagrams?|maps?|logos?|flags?|portraits?|paintings?|coat of arms|sheet music|scientific figures?|microscopy|specimens?|holotypes?|paratypes?)\b/.test(description)) return false
  const words = normalize(query).split(' ').filter(word => word.length > 2 && !['the', 'and', 'with', 'for', 'from', 'this', 'that', 'little', 'some', 'our', 'your', 'into'].includes(word))
  // Match named subjects in metadata, rather than incidental full-text search hits.
  return words.length > 0 && words.filter(word => description.includes(word)).length >= Math.min(3, words.length)
}
async function lookup(query: string, width: number): Promise<Photo[]> {
  if (Date.now() < retryAfter) await new Promise(resolve => window.setTimeout(resolve, retryAfter - Date.now()))
  const params = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `${query} filetype:bitmap -map -logo -newspaper -scan -manuscript -illustration`, gsrnamespace: '6', gsrlimit: '4', prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime|mediatype', iiurlwidth: String(width), format: 'json', origin: '*' })
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: AbortSignal.timeout(6000) })
  if (!response.ok) {
    if (response.status === 429) retryAfter = Date.now() + Math.min(300, Math.max(30, Number(response.headers.get('Retry-After')) || 60)) * 1000
    // Do not cache an outage or a rate limit as a permanent empty search.
    throw new Error('Photo discovery is unavailable')
  }
  const body = await response.json() as { query?: { pages?: Record<string, { index: number; title: string; imageinfo?: ImageInfo[] }> } }
  return Object.values(body.query?.pages ?? {}).sort((a, b) => a.index - b.index).flatMap(page => {
    const info = page.imageinfo?.[0]
    if (!info || !relevantPhoto(page.title ?? '', info, query)) return []
    const photo = { title: page.title.replace(/^File:/, ''), licenseUrl: info.extmetadata?.LicenseUrl?.value, changes: 'Resized by Wikimedia Commons; cropped to fit the card.', url: info.thumburl, source: info.descriptionurl, author: plain(info.extmetadata?.Artist?.value ?? ''), license: plain(info.extmetadata?.LicenseShortName?.value ?? ''), ...(safeUrl(info.url, 'upload.wikimedia.org') ? { fullUrl: info.url, fullWidth: info.width, fullHeight: info.height } : {}) }
    return validPhoto(photo) && photo.author ? [photo] : []
  })
}
function candidates(query: string, width: number): Promise<Photo[]> {
  const cacheId = width === 640 ? query : `${width}:${query}`
  if (memory.has(cacheId)) return Promise.resolve(memory.get(cacheId)!)
  if (pending.has(cacheId)) return pending.get(cacheId)!
  const job = throttled(async () => {
    try { return await lookup(query, width) }
    catch (error) { if (Date.now() < retryAfter) return lookup(query, width); throw error }
  }).then(photos => {
    memory.set(cacheId, photos)
    if (memory.size > 100) memory.delete(memory.keys().next().value!)
    try { sessionStorage.setItem(cacheKey, JSON.stringify(Object.fromEntries(memory))) } catch { /* Optional cache. */ }
    return photos
  }).catch(() => []).finally(() => pending.delete(cacheId))
  pending.set(cacheId, job)
  return job
}

// Looking up photos is deferred until the image approaches the viewport.
// Cards keep their bundled illustration if an external service is unavailable.
export function useActivityPhoto(queries: string | Array<string | undefined> | undefined, fallback: string, width: 640 | 1280 | 1600 | 3840 = 1280) {
  const key = JSON.stringify([...new Set((Array.isArray(queries) ? queries : [queries]).map(value => value?.trim().slice(0, 100)).filter(Boolean))].slice(0, 2))
  const selectionKey = `${width}:${key}`
  const ref = useRef<HTMLImageElement>(null)
  const [selection, setSelection] = useState<{ key: string; photo: Photo } | null>(null)
  const [failed, setFailed] = useState<string[]>([])
  useEffect(() => {
    let current = true
    const load = async () => {
      for (const query of JSON.parse(key) as string[]) {
        if (!current) return
        for (const photo of await candidates(query, width)) {
          if (!current) return
          // Keep the current bundled image until the remote thumbnail has loaded.
          const loaded = await new Promise<boolean>(resolve => {
            const image = new Image()
            const timer = window.setTimeout(() => { image.onload = null; image.onerror = null; resolve(false) }, 5000)
            image.onload = () => { clearTimeout(timer); resolve(image.naturalWidth > 0) }
            image.onerror = () => { clearTimeout(timer); resolve(false) }
            image.src = photo.url
          })
          if (loaded && current) { setSelection({ key: selectionKey, photo }); return }
        }
      }
    }
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load() }
    }, { rootMargin: '150px' })
    observer.observe(element)
    return () => { current = false; observer.disconnect() }
  }, [key, selectionKey, width])
  const photo = selection?.key === selectionKey && !failed.includes(selection.photo.url) ? selection.photo : null
  const src = photo?.url ?? (failed.includes(fallback) ? placeholder : fallback)
  const onError = (_event: SyntheticEvent<HTMLImageElement>) => {
    if (src !== placeholder) setFailed(values => values.includes(src) ? values : [...values, src])
  }
  return { src, ref, credit: photo, onError }
}
// Expose source attribution on the dedicated credits page, away from trip cards.
export function discoveredPhotoCredits(): Photo[] {
  return [...new Map([...memory.values()].flat().map(photo => [photo.source, photo])).values()]
}
