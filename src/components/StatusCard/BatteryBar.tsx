const SEGMENTS = 10

/** Ten-segment bar. Decorative: the percentage next to it carries the value. */
export function BatteryBar({ level, low }: { level: number; low: boolean }) {
  const filled = Math.round(Math.max(0, Math.min(100, level)) / (100 / SEGMENTS))
  return (
    <span className={`battery-bar${low ? ' battery-bar--low' : ''}`} aria-hidden="true">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={`battery-bar__segment${i < filled ? ' battery-bar__segment--on' : ''}`} />
      ))}
    </span>
  )
}
