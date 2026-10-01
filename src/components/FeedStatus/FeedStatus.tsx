import type { FeedMode } from '../../api'
import { useNow } from '../../hooks/useNow'
import { isStale } from '../../utils/status'
import { formatRelative } from '../../utils/time'
import './FeedStatus.css'

type Kind = FeedMode | 'stale' | 'demo'

interface Props {
  mode: FeedMode
  /** How many vehicles of the fleet report as online. */
  onlineCount: number
  /** ISO time of the freshest position among the online vehicles. The warning is about the whole fleet:
   *  one idle or offline vehicle is not a feed problem, and its own age is already on the status card. */
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
export function FeedStatus({ mode, onlineCount, lastFix, demo, onEnterDemo, onExitDemo }: Props) {
  const now = useNow(10_000)
  const quiet = onlineCount === 0
  const stale = !demo && mode !== 'lost' && (quiet || (lastFix !== null && isStale(lastFix, now)))
  const kind: Kind = demo ? 'demo' : stale ? 'stale' : mode

  const text: Record<Kind, string> = {
    live: 'En vivo',
    polling: 'Actualizando cada 5 s',
    lost: 'Sin conexión · datos desactualizados',
    stale: quiet
      ? 'Ningún vehículo en línea'
      : `Sin datos nuevos · ${lastFix ? formatRelative(lastFix, now).toLowerCase() : ''}`,
    demo: 'Modo demostración · datos simulados',
  }

  // At most one action: look at simulated data when the real feed is unusable, or go back to the real one.
  const action =
    (kind === 'stale' || kind === 'lost') && onEnterDemo
      ? { label: 'Ver modo demostración', run: onEnterDemo }
      : kind === 'demo' && onExitDemo
        ? { label: 'Volver a datos reales', run: onExitDemo }
        : null

  return (
    <div className="feed-overlay">
      <p className={`feed-status feed-status--${kind}`} role="status">
        <span className="feed-status__dot" aria-hidden="true" />
        {text[kind]}
      </p>
      {action && (
        <button type="button" className="feed-overlay__action" onClick={action.run}>
          {action.label}
        </button>
      )}
    </div>
  )
}
