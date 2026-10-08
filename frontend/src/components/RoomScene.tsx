import { Activity, useState, type ReactNode } from 'react'

/** Keep visited views and drafts, while suspending effects in inactive room sections. */
export function RoomScene({ active, motion = active, children }: { active: boolean; motion?: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active)
  if (active && !visited) setVisited(true)
  if (!active && !visited) return null
  return <Activity mode={active ? 'visible' : 'hidden'}><div className="room-scene" data-active={active && motion}>{children}</div></Activity>
}
