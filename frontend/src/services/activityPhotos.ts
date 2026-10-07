import { createElement, useEffect, useRef, useState } from 'react'

type Photo = { url: string; source: string; author: string; license: string }
const cacheKey = 'gotogether.activity-photos.v3'
const safeUrl = (value: unknown, host: string) => {
  try { const url = new URL(String(value)); return url.protocol === 'https:' && url.hostname === host } catch { return false }
}
function validPhoto(value: unknown): value is Photo {
  const photo = value as Photo | null
  return Boolean(photo && safeUrl(photo.url, 'upload.wikimedia.org') && safeUrl(photo.source, 'commons.wikimedia.org') && typeof photo.author === 'string' && photo.author.length <= 160 && typeof photo.license === 'string' && /^(CC BY|CC0|Public domain)/i.test(photo.license))
}
function readCache(): Array<[string, Photo[]]> {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(cacheKey) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    return Object.entries(value).slice(-100).filter(([query, items]) => query.length <= 100 && Array.isArray(items)).map(([query, items]) => [query, (items as unknown[]).filter(validPhoto).slice(0, 4)])
  } catch { return [] }
}
const memory = new Map<string, Photo[]>(readCache())
const pending = new Map<string, Promise<Photo[]>>()
const waiting: Array<() => void> = []
let active = 0
async function throttled<T>(task: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve))
  active++
  try { return await task() } finally { active--; waiting.shift()?.() }
}
const plain = (value: string) => new DOMParser().parseFromString(value, 'text/html').body.textContent?.trim().slice(0, 160) || ''
async function lookup(query: string): Promise<Photo[]> {
  const params = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `${query} filetype:bitmap -map -logo`, gsrnamespace: '6', gsrlimit: '4', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '640', format: 'json', origin: '*' })
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: AbortSignal.timeout(6000) })
  if (!response.ok) return []
  const body = await response.json() as { query?: { pages?: Record<string, { index: number; imageinfo?: Array<{ thumburl: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> }> }> } }
  return Object.values(body.query?.pages ?? {}).sort((a, b) => a.index - b.index).flatMap(page => {
    const info = page.imageinfo?.[0]
    if (!info || /\.svg|\.gif|map|flag_of|coat_of_arms|logo|locator|diagram/i.test(info.thumburl)) return []
    const photo = { url: info.thumburl, source: info.descriptionurl, author: plain(info.extmetadata?.Artist?.value ?? ''), license: plain(info.extmetadata?.LicenseShortName?.value ?? '') }
    return validPhoto(photo) && photo.author ? [photo] : []
  })
}
function candidates(query: string): Promise<Photo[]> {
  if (memory.has(query)) return Promise.resolve(memory.get(query)!)
  if (pending.has(query)) return pending.get(query)!
  if (pending.size >= 24) return Promise.resolve([])
  const job = throttled(() => lookup(query)).then(photos => {
    memory.set(query, photos)
    if (memory.size > 100) memory.delete(memory.keys().next().value!)
    try { sessionStorage.setItem(cacheKey, JSON.stringify(Object.fromEntries(memory))) } catch { /* Optional cache. */ }
    return photos
  }).catch(() => []).finally(() => pending.delete(query))
  pending.set(query, job)
  return job
}

// Looking up photos is deferred until the image approaches the viewport.
// Cards keep their bundled illustration if an external service is unavailable.
export function useActivityPhoto(queries: string | Array<string | undefined> | undefined, fallback: string) {
  const key = JSON.stringify([...new Set((Array.isArray(queries) ? queries : [queries]).map(value => value?.trim().slice(0, 100)).filter(Boolean))].slice(0, 2))
  const ref = useRef<HTMLImageElement>(null)
  const [selection, setSelection] = useState<{ key: string; photo: Photo } | null>(null)
  useEffect(() => {
    let current = true
    const load = async () => {
      for (const query of JSON.parse(key) as string[]) {
        if (!current) return
        const [photo] = await candidates(query)
        if (photo && current) { setSelection({ key, photo }); return }
      }
    }
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load() }
    }, { rootMargin: '150px' })
    observer.observe(element)
    return () => { current = false; observer.disconnect() }
  }, [key])
  const photo = selection?.key === key ? selection.photo : null
  return { src: photo?.url ?? fallback, ref, credit: photo }
}
export function PhotoCredit({ credit }: { credit: Photo | null }) {
  return credit ? createElement('a', { className: 'travel-photo-credit', href: credit.source, target: '_blank', rel: 'noreferrer' }, `Photo: ${credit.author} · ${credit.license}`) : null
}
