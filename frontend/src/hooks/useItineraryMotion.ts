import { useLayoutEffect, useRef, type RefObject } from 'react'

/** Animate the distance between saved layouts, without optimistic edits to itinerary data. */
export function useItineraryMotion(container: RefObject<HTMLDivElement | null>, dayId: string, order: string) {
  const previous = useRef<{ day: string; positions: Map<string, { x: number; y: number }> }>({ day: '', positions: new Map() })
  useLayoutEffect(() => () => { previous.current = { day: '', positions: new Map() } }, [])
  useLayoutEffect(() => {
    const elements = [...container.current?.querySelectorAll<HTMLElement>('[data-motion-item]') ?? []]
    const animations: Animation[] = []
    const positions = new Map<string, { x: number; y: number }>()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    for (const element of elements) {
      const rect = element.getBoundingClientRect()
      if (!rect.width || !rect.height) continue
      const key = element.dataset.motionItem!
      const next = { x: rect.left + window.scrollX, y: rect.top + window.scrollY }
      positions.set(key, next)
      const before = previous.current.day === dayId ? previous.current.positions.get(key) : undefined
      if (before && !reduced.matches && element.animate) {
        const dx = before.x - next.x, dy = before.y - next.y
        if (Math.abs(dx) + Math.abs(dy) > 1) animations.push(element.animate([
          { transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' },
        ], { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' }))
      }
    }
    previous.current = { day: dayId, positions }
    const cancel = () => animations.forEach(animation => animation.cancel())
    reduced.addEventListener('change', cancel)
    return () => { cancel(); reduced.removeEventListener('change', cancel) }
  }, [container, dayId, order])
}
