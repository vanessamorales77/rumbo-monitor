import type { ReactNode } from 'react'

/** Re-mounts on every change so the CSS highlight animation replays (no JS animation loop). */
export function AnimatedValue({ value, children }: { value: string | number; children?: ReactNode }) {
  return (
    <span key={value} className="animated-value">
      {children ?? value}
    </span>
  )
}
