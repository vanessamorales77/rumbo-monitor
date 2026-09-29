import { useState } from 'react'
import type { Device } from '../../api'
import type { Position } from '../../api'
import { useNow } from '../../hooks/useNow'
import { connectionLabel } from '../../utils/status'
import { formatClock, formatRelative } from '../../utils/time'
import { knotsToKmh } from '../../utils/units'
import { ConnectionIndicator } from '../ConnectionIndicator/ConnectionIndicator'
import { useTweenedNumber } from '../../hooks/useTweenedNumber'
import { AnimatedValue } from './AnimatedValue'
import { FadeText } from './FadeText'
import './StatusCard.css'

const LOW_BATTERY = 20

interface Props {
  device: Device
  position: Position | null
}

export function StatusCard({ device, position }: Props) {
  const now = useNow()
  const speed = position ? knotsToKmh(position.speed) : null
  const battery = position?.attributes.batteryLevel ?? null
  const batteryLow = battery !== null && battery <= LOW_BATTERY
  const shownSpeed = useTweenedNumber(speed)
  const shownBattery = useTweenedNumber(battery)
  const announcement = useAnnouncement(device, speed, batteryLow)

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
                <span className="status-card__number">{Math.round(shownSpeed ?? speed)}</span>
                <span className="status-card__unit">km/h</span>
              </AnimatedValue>
            )}
          </dd>
        </div>

        <div className="status-card__row">
          <dt>Batería</dt>
          <dd className={`status-card__value${batteryLow ? ' status-card__value--alert' : ''}`}>
            {battery === null ? (
              'No disponible'
            ) : (
              <>
                <BatteryIcon level={shownBattery ?? battery} />
                <AnimatedValue value={battery}>{Math.round(shownBattery ?? battery)} %</AnimatedValue>
                {batteryLow && <span>· Batería baja</span>}
              </>
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
                  <AnimatedValue value={position.fixTime}>
                    <FadeText text={formatRelative(position.fixTime, now)} />
                  </AnimatedValue>
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

/** Filled portion is proportional to the level; the outline keeps its shape for any value. */
function BatteryIcon({ level }: { level: number }) {
  const width = Math.max(0, Math.min(100, level)) * 0.12
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" className="status-card__icon">
      <rect x="2" y="7" width="17" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M22 10.5v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="4" y="9" width={width} height="6" rx="1" fill="currentColor" />
    </svg>
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
 * Announce connection changes, low battery and speed changes of 10 km/h or more.
 * Baseline lives in state and is adjusted during render (no effect needed);
 * switching vehicle resets it silently.
 */
function useAnnouncement(device: Device, speed: number | null, batteryLow: boolean): string {
  const [state, setState] = useState({ deviceId: device.id, status: device.status, speed, batteryLow, text: '' })

  if (state.deviceId !== device.id) {
    setState({ deviceId: device.id, status: device.status, speed, batteryLow, text: '' })
    return ''
  }

  const parts: string[] = []
  let nextSpeed = state.speed
  if (state.status !== device.status) parts.push(`${device.name}: ${connectionLabel(device.status)}`)
  if (speed !== null && (state.speed === null || Math.abs(speed - state.speed) >= 10)) {
    parts.push(`velocidad ${speed} kilómetros por hora`)
    nextSpeed = speed
  }
  if (state.batteryLow !== batteryLow) parts.push(batteryLow ? 'batería baja' : 'batería recuperada')
  if (parts.length > 0) {
    setState({ deviceId: device.id, status: device.status, speed: nextSpeed, batteryLow, text: parts.join(', ') })
  }
  return state.text
}
