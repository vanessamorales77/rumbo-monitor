import { useEffect, useState } from 'react'
import '../StatusCard/StatusCard.css'
import './Skeleton.css'

/** Same container and row classes as StatusCard, so heights match exactly. */
export function CardSkeleton() {
  return (
    <div className="status-card" aria-hidden="true">
      <div className="status-card__header">
        <span className="skeleton skeleton--title" />
        <div className="status-card__badges">
          <span className="skeleton skeleton--plate" />
          <span className="skeleton skeleton--pill" />
        </div>
      </div>
      <div className="status-card__data">
        <div className="status-card__row">
          <span className="skeleton skeleton--label" />
          <span className="skeleton skeleton--gauge" />
        </div>
        <div className="status-card__row">
          <span className="skeleton skeleton--label" />
          <span className="skeleton skeleton--value" />
        </div>
        <div className="status-card__row">
          <span className="skeleton skeleton--label" />
          <span className="skeleton skeleton--value" />
        </div>
      </div>
    </div>
  )
}

/** Reserves the one-line status strip that sits above the map on a phone, so it never pushes the layout down. */
export function FeedSkeleton() {
  return <span className="skeleton skeleton--feed" aria-hidden="true" />
}

/** After this long without data the loading text admits it is slow: silence is the worst thing in a control room. */
const SLOW_AFTER_MS = 5_000

interface MapSkeletonProps {
  /** The map underneath is ready: fade out. */
  leaving?: boolean
  /** Force the "taking longer" wording (stories); by default it appears after 5 s. */
  slow?: boolean
}

export function MapSkeleton({ leaving = false, slow }: MapSkeletonProps) {
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setWaited(true), SLOW_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className={`skeleton skeleton--map${leaving ? ' skeleton--leaving' : ''}`} aria-hidden={leaving || undefined}>
      <p className="skeleton-map__pill" role="status">
        <span className="skeleton-map__spinner" aria-hidden="true" />
        {(slow ?? waited) && !leaving ? 'Está tardando más de lo normal…' : 'Cargando…'}
      </p>
    </div>
  )
}
