import { useState } from 'react'
import type { Device } from '../../api'
import type { Position } from '../../api'
import { useNow } from '../../hooks/useNow'
import { connectionLabel } from '../../utils/status'
import { formatClock, formatRelative } from '../../utils/time'
import { knotsToKmh } from '../../utils/units'
import { ConnectionIndicator } from '../ConnectionIndicator/ConnectionIndicator'
import { AnimatedValue } from './AnimatedValue'
import './StatusCard.css'

interface Props {
  device: Device
  position: Position | null
}

export function StatusCard({ device, position }: Props) {
  const now = useNow()
  const speed = position ? knotsToKmh(position.speed) : null
  const announcement = useAnnouncement(device, speed)

  return (
    <section className="status-card" aria-labelledby="status-card-title">
      <header className="status-card__header">
        <h2 id="status-card-title" className="status-card__title">
          {device.name}
        </h2>
        <ConnectionIndicator status={device.status} />
      </header>

      <dl className="status-card__data">
        <div className="status-card__row">
          <dt>Velocidad</dt>
          <dd className="status-card__value status-card__value--hero">
            {speed === null ? (
              '—'
            ) : (
              <AnimatedValue value={speed}>
                <span className="status-card__number">{speed}</span>
                <span className="status-card__unit">km/h</span>
              </AnimatedValue>
            )}
          </dd>
        </div>

        <div className="status-card__row">
          <dt>Última actualización</dt>
          <dd className="status-card__value">
            {position ? (
              <>
                <ClockIcon />
                <time dateTime={position.fixTime} title={formatClock(position.fixTime)}>
                  <AnimatedValue value={position.fixTime}>{formatRelative(position.fixTime, now)}</AnimatedValue>
                </time>
              </>
            ) : (
              'Sin datos todavía'
            )}
          </dd>
        </div>
      </dl>

      {/* Screen readers get meaningful changes only, not every GPS tick. */}
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" className="status-card__icon">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </g>
    </svg>
  )
}

/**
 * Announce connection changes and speed changes of 10 km/h or more.
 * Baseline lives in state and is adjusted during render (no effect needed);
 * switching vehicle resets it silently.
 */
function useAnnouncement(device: Device, speed: number | null): string {
  const [state, setState] = useState({ deviceId: device.id, status: device.status, speed, text: '' })

  if (state.deviceId !== device.id) {
    setState({ deviceId: device.id, status: device.status, speed, text: '' })
    return ''
  }

  const parts: string[] = []
  let nextSpeed = state.speed
  if (state.status !== device.status) parts.push(`${device.name}: ${connectionLabel(device.status)}`)
  if (speed !== null && (state.speed === null || Math.abs(speed - state.speed) >= 10)) {
    parts.push(`velocidad ${speed} kilómetros por hora`)
    nextSpeed = speed
  }
  if (parts.length > 0) {
    setState({ deviceId: device.id, status: device.status, speed: nextSpeed, text: parts.join(', ') })
  }
  return state.text
}
