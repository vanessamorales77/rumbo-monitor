import type { FeedMode } from '../../api'
import './FeedStatus.css'

const COPY: Record<FeedMode, string> = {
  live: 'En vivo',
  polling: 'Actualizando cada 5 s',
  lost: 'Sin conexión · datos desactualizados',
}

/** How fresh the data is. Dot + text, never colour alone; changes are announced politely. */
export function FeedStatus({ mode }: { mode: FeedMode }) {
  return (
    <p className={`feed-status feed-status--${mode}`} role="status">
      <span className="feed-status__dot" aria-hidden="true" />
      {COPY[mode]}
    </p>
  )
}
