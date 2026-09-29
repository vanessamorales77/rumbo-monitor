import type { ReactNode } from 'react'

const MAX_KMH = 120

interface Props {
  /** Speed in km/h (already eased by the caller). */
  value: number
  /** The readable number; the arc is only a visual echo of it. */
  children: ReactNode
}

/** Semicircular gauge, 0 to 120 km/h. Decorative: the value is always in the text. */
export function SpeedGauge({ value, children }: Props) {
  const fill = Math.max(0, Math.min(1, value / MAX_KMH)) * 100
  return (
    <div className="speed-gauge">
      <svg className="speed-gauge__svg" viewBox="0 0 240 132" aria-hidden="true" focusable="false">
        <path className="speed-gauge__track" d="M 24 120 A 96 96 0 0 1 216 120" pathLength="100" />
        {fill > 0.5 && (
          <path className="speed-gauge__arc" d="M 24 120 A 96 96 0 0 1 216 120" pathLength="100" strokeDasharray={`${fill} 100`} />
        )}
      </svg>
      <div className="speed-gauge__value">{children}</div>
    </div>
  )
}
