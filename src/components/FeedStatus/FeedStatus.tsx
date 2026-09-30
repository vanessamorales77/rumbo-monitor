import type { FeedMode } from '../../api'
import { useNow } from '../../hooks/useNow'
import { formatRelative } from '../../utils/time'
import './FeedStatus.css'

/** A position older than this, on a feed that looks connected, is reported as "no new data". */
export const STALE_AFTER_MS = 2 * 60_000

type Kind = FeedMode | 'stale' | 'demo'

interface Props {
  mode: FeedMode
  /** ISO time of the selected vehicle's last position, if it has one. */
  lastFix: string | null
  /** The data on screen is simulated. */
  demo: boolean
  /** Offered when data is stale or lost: switch to simulated data. */
  onEnterDemo?: () => void
  /** Offered in demo mode: go back to the real feed. */
  onExitDemo?: () => void
}

/**
 * How trustworthy the numbers on screen are, in one line.
 * Connected is not the same as fresh: a live socket can still deliver nothing new.
 * Dot + text, never colour alone; changes are announced politely.
 */
export function FeedStatus({ mode, lastFix, demo, onEnterDemo, onExitDemo }: Props) {
  const now = useNow(10_000)
  const stale = !demo && mode !== 'lost' && lastFix !== null && now - Date.parse(lastFix) > STALE_AFTER_MS
  const kind: Kind = demo ? 'demo' : stale ? 'stale' : mode

  const text: Record<Kind, string> = {
    live: 'En vivo',
    polling: 'Actualizando cada 5 s',
    lost: 'Sin conexión · datos desactualizados',
    stale: `Sin datos nuevos · ${lastFix ? formatRelative(lastFix, now).toLowerCase() : ''}`,
    demo: 'Modo demostración · datos simulados',
  }

  const offerDemo = (kind === 'stale' || kind === 'lost') && onEnterDemo
  const offerReal = kind === 'demo' && onExitDemo

  return (
    <div className="feed-overlay">
      <p className={`feed-status feed-status--${kind}`} role="status">
        <span className="feed-status__dot" aria-hidden="true" />
        {text[kind]}
      </p>
      {offerDemo && (
        <button type="button" className="feed-overlay__action" onClick={onEnterDemo}>
          Ver modo demostración
        </button>
      )}
      {offerReal && (
        <button type="button" className="feed-overlay__action" onClick={onExitDemo}>
          Volver a datos reales
        </button>
      )}
    </div>
  )
}
