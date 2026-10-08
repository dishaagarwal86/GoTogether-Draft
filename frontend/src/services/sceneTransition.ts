import { flushSync } from 'react-dom'

type Scene = 'room' | 'preview' | 'day' | 'tools' | 'preferences'
type Direction = 'forward' | 'back'
const easing = 'cubic-bezier(.22, 1, .36, 1)'
let stopPrevious: (() => void) | undefined

const visible = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].filter(element => element.getClientRects().length)

/** Animate live components. Snapshot transitions make captured controls temporarily inert. */
export function changeScene(update: () => void, scene: Scene, direction: Direction = 'forward', after?: () => void, photo?: HTMLElement | null) {
  stopPrevious?.()
  const source = photo ?? (scene === 'room' ? visible('.group-preview-cover, .canvas-cover')[0] : undefined)
  const from = source?.getBoundingClientRect()
  const sourceImage = source?.querySelector('img')
  const image = sourceImage?.cloneNode() as HTMLImageElement | undefined
  const background = source ? getComputedStyle(source).backgroundImage : ''
  // Only synchronous UI updates belong here. API calls and saves have their own lifecycle.
  flushSync(update)
  after?.()
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (document.hidden || reduced.matches || !Element.prototype.animate) return

  const root = document.documentElement
  root.dataset.questMotion = scene
  root.dataset.questDirection = direction
  const animations: Animation[] = []
  let flight: HTMLDivElement | undefined
  const enter = (element: HTMLElement, x = 0, y = direction === 'back' ? -10 : 14) => {
    animations.push(element.animate([{ opacity: .2, transform: `translate(${x}px, ${y}px)` }, { opacity: 1, transform: 'translate(0, 0)' }], { duration: 320, easing }))
  }
  const cleanup = () => {
    animations.forEach(animation => animation.cancel())
    flight?.remove()
    document.removeEventListener('pointerdown', cleanup, true)
    document.removeEventListener('keydown', cleanup, true)
    reduced.removeEventListener('change', cleanup)
    if (stopPrevious === cleanup) {
      stopPrevious = undefined
      delete root.dataset.questMotion
      delete root.dataset.questDirection
    }
  }
  stopPrevious = cleanup
  try {
    const target = visible(scene === 'preview' ? '.group-preview-cover' : '.canvas-cover, .group-preview-cover')[0]
    const to = target?.getBoundingClientRect()
    const selectors: Record<Scene, string> = {
      room: '.room-scene[data-active=true]', preview: '.group-itinerary-detail',
      day: '.canvas-timeline, .group-preview-days', tools: '.canvas-panel.is-open',
      preferences: '.member-preferences header, .member-preferences fieldset',
    }
    for (const element of visible(selectors[scene])) {
      if (scene === 'tools') enter(element, window.innerWidth > 900 ? 20 : 0, window.innerWidth > 900 ? 0 : 28)
      else enter(element)
    }
    if (source && target && to?.width && to.height && from?.width && from.height && (image || background && background !== 'none') && (photo || scene === 'room' && source !== target)) {
      flight = document.createElement('div')
      flight.className = 'quest-photo-flight'
      flight.setAttribute('aria-hidden', 'true')
      flight.inert = true
      if (image) { image.alt = ''; flight.append(image) }
      else flight.style.backgroundImage = background
      document.body.append(flight)
      animations.push(flight.animate([
        { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, opacity: 1, offset: 0 },
        { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, opacity: .9, offset: .8 },
        { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, opacity: 0, offset: 1 },
      ], { duration: 440, easing, fill: 'both' }))
    }
    // A new interaction always wins over decoration, including a drag started mid-animation.
    document.addEventListener('pointerdown', cleanup, true)
    document.addEventListener('keydown', cleanup, true)
    reduced.addEventListener('change', cleanup)
    void Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(cleanup)
  } catch { cleanup() } // Animation support must never prevent navigation or editing.
}
