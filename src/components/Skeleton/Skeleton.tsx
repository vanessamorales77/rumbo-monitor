import '../StatusCard/StatusCard.css'
import './Skeleton.css'

/** Same container and row classes as StatusCard, so heights match exactly. */
export function CardSkeleton() {
  return (
    <div className="status-card" aria-hidden="true">
      <div className="status-card__header">
        <span className="skeleton skeleton--eyebrow" />
        <span className="skeleton skeleton--title" />
        <span className="skeleton skeleton--pill" />
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

export function MapSkeleton() {
  return (
    <div className="skeleton skeleton--map">
      <p className="skeleton-map__pill" role="status">
        <span className="skeleton-map__spinner" aria-hidden="true" />
        Cargando…
      </p>
    </div>
  )
}
