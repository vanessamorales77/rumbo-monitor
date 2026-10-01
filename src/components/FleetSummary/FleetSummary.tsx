import './FleetSummary.css'

/** "2 de 3 en línea": the fleet at a glance, whichever vehicle is selected. Dot + text, never colour alone. */
export function FleetSummary({ online, total, className = '' }: { online: number; total: number; className?: string }) {
  if (total === 0) return null
  return (
    <p className={`fleet-summary${online > 0 ? ' fleet-summary--active' : ''} ${className}`.trim()}>
      <span className="fleet-summary__dot" aria-hidden="true" />
      {online} de {total} en línea
    </p>
  )
}
