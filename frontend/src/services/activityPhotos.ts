import { useEffect, useState } from 'react'

const cacheKey = 'gotogether.activity-photos.v2'
const memory = new Map<string, string[]>(Object.entries(readCache()))
const pending = new Map<string, Promise<string[]>>()
const inUse = new Map<string, number>()
const waiting: Array<() => void> = []
let active = 0

function readCache(): Record<string, string[]> {
  try { return JSON.parse(sessionStorage.getItem(cacheKey) ?? '{}') } catch { return {} }
}
function writeCache() {
  try { sessionStorage.setItem(cacheKey, JSON.stringify(Object.fromEntries([...memory].slice(-300)))) } catch { /* storage is a convenience only */ }
}

// Wikimedia rate-limits bursts, so lookups run two at a time.
async function throttled<T>(task: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve))
  active++
  try { return await task() } finally { active--; waiting.shift()?.() }
}

const notAPhoto = /\.svg|\.gif|map|flag_of|coat_of_arms|logo|locator|diagram|icon|seal_of/i
type Pages = { query?: { pages?: Record<string, { index: number; thumbnail?: { source?: string }; imageinfo?: Array<{ thumburl?: string }> }> } }
const ordered = (body: Pages) => Object.values(body.query?.pages ?? {}).sort((a, b) => a.index - b.index)

async function wikimedia(host: string, params: Record<string, string>) {
  const response = await fetch(`https://${host}/w/api.php?${new URLSearchParams({ ...params, format: 'json', origin: '*' })}`)
  if (!response.ok) throw new Error(String(response.status))
  return response.json() as Promise<Pages>
}

// A matching Wikipedia article's lead image is usually the iconic shot; Commons fills in alternatives.
async function lookup(query: string): Promise<string[]> {
  const [article, commons] = await Promise.all([
    wikimedia('en.wikipedia.org', { action: 'query', generator: 'search', gsrsearch: query, gsrlimit: '2', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '640' }).catch(() => ({} as Pages)),
    wikimedia('commons.wikimedia.org', { action: 'query', generator: 'search', gsrsearch: `${query} filetype:bitmap -map -logo`, gsrnamespace: '6', gsrlimit: '6', prop: 'imageinfo', iiprop: 'url', iiurlwidth: '640' }).catch(() => ({} as Pages)),
  ])
  const urls = [...ordered(article).map(page => page.thumbnail?.source), ...ordered(commons).map(page => page.imageinfo?.[0]?.thumburl)]
  return [...new Set(urls.filter((url): url is string => Boolean(url) && !notAPhoto.test(url!)))]
}

function candidates(query: string): Promise<string[]> {
  if (memory.has(query)) return Promise.resolve(memory.get(query)!)
  if (!pending.has(query)) pending.set(query, throttled(() => lookup(query)).then(urls => { memory.set(query, urls); writeCache(); return urls }).catch(() => []).finally(() => pending.delete(query)))
  return pending.get(query)!
}

function claim(url: string) { inUse.set(url, (inUse.get(url) ?? 0) + 1) }
function release(url: string) {
  const count = (inUse.get(url) ?? 1) - 1
  if (count > 0) inUse.set(url, count); else inUse.delete(url)
}

// Tries each query in order and takes the best photo no other card on screen is showing.
export function useActivityPhoto(queries: string | Array<string | undefined> | undefined, fallback: string) {
  const list = (Array.isArray(queries) ? queries : [queries]).map(query => query?.trim()).filter((query): query is string => Boolean(query))
  const key = list.join('|')
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    let chosen: string | null = null
    ;(async () => {
      for (const query of key ? key.split('|') : []) {
        const urls = await candidates(query)
        if (!current) return
        const free = urls.find(candidate => !inUse.has(candidate))
        if (free) { chosen = free; claim(free); setUrl(free); return }
      }
      setUrl(null)
    })()
    return () => { current = false; if (chosen) release(chosen) }
  }, [key])
  return url ?? fallback
}
