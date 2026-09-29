import './Skeleton.css'

/** Mirrors the final layout dimensions so nothing shifts when data arrives. */
export function CardSkeleton() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <span className="skeleton skeleton--title" />
      <span className="skeleton skeleton--pill" />
      <span className="skeleton skeleton--hero" />
      <span className="skeleton skeleton--row" />
      <span className="skeleton skeleton--row" />
      <span className="skeleton skeleton--row" />
    </div>
  )
}

export function MapSkeleton() {
  return <div className="skeleton skeleton--map" aria-hidden="true" />
}
