import { useEffect, useRef, useState } from 'react'
import type { Device, FeedMode, Position } from '../../api'
import { useNow } from '../../hooks/useNow'
import { knotsToKmh } from '../../utils/units'
import { formatClock, formatRelative } from '../../utils/time'
import { ConnectionIndicator, connectionLabel } from '../ConnectionIndicator/ConnectionIndicator'
import { AnimatedValue } from './AnimatedValue'
import './StatusCard.css'

interface Props {
  device: Device
  position: Position | null
  mode: FeedMode
}

export function StatusCard({ device, position, mode }: Props) {
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
        <div className="status-card__row status-card__row--hero">
          <dt>Velocidad</dt>
          <dd>
            {speed === null ? (
              '—'
            ) : (
              <AnimatedValue value={speed}>
                <span className="status-card__number">{speed}</span>
                <span className="status-card__unit"> km/h</span>
              </AnimatedValue>
            )}
          </dd>
        </div>

        {position?.attributes.batteryLevel !== undefined && (
          <div className="status-card__row">
            <dt>Batería</dt>
            <dd>
              <AnimatedValue value={position.attributes.batteryLevel}>{position.attributes.batteryLevel} %</AnimatedValue>
            </dd>
          </div>
        )}

        {position && (
          <div className="status-card__row">
            <dt>Rumbo</dt>
            <dd>
              <AnimatedValue value={Math.round(position.course)}>{Math.round(position.course)}°</AnimatedValue>
            </dd>
          </div>
        )}

        <div className="status-card__row">
          <dt>Última actualización</dt>
          <dd>
            {position ? (
              <>
                <AnimatedValue value={position.fixTime}>{formatClock(position.fixTime)}</AnimatedValue>
                <span className="status-card__relative">{formatRelative(position.fixTime, now)}</span>
              </>
            ) : (
              'Sin posición registrada'
            )}
          </dd>
        </div>
      </dl>

      <p className="status-card__feed">
        <span className={`status-card__feed-dot status-card__feed-dot--${mode}`} aria-hidden="true" />
        {mode === 'live' ? 'Datos en vivo' : 'Actualizando cada 5 s'}
      </p>

      {/* Screen readers get meaningful changes only, not every GPS tick. */}
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  )
}

/** Announce connection changes and speed changes of 10 km/h or more. */
function useAnnouncement(device: Device, speed: number | null): string {
  const [text, setText] = useState('')
  const last = useRef<{ status: string; speed: number | null } | null>(null)

  useEffect(() => {
    const previous = last.current
    if (previous === null) {
      last.current = { status: device.status, speed }
      return
    }
    const parts: string[] = []
    if (previous.status !== device.status) {
      parts.push(`${device.name}: ${connectionLabel(device.status)}`)
      last.current = { ...previous, status: device.status }
    }
    if (speed !== null && (previous.speed === null || Math.abs(speed - previous.speed) >= 10)) {
      parts.push(`velocidad ${speed} kilómetros por hora`)
      last.current = { ...(last.current ?? previous), speed }
    }
    if (parts.length) setText(parts.join(', '))
  }, [device.status, device.name, speed])

  return text
}
