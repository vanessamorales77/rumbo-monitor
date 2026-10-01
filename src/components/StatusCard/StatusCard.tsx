import { useState } from 'react'
import type { Device, Position } from '../../api'
import { useNow } from '../../hooks/useNow'
import { useTweenedNumber } from '../../hooks/useTweenedNumber'
import { connectionLabel, hasCurrentSpeed } from '../../utils/status'
import { formatRelative } from '../../utils/time'
import { knotsToKmh } from '../../utils/units'
import { splitVehicleName } from '../../utils/vehicleName'
import { ConnectionIndicator } from '../ConnectionIndicator/ConnectionIndicator'
import { LicensePlate } from '../LicensePlate/LicensePlate'
import { AnimatedValue } from './AnimatedValue'
import { BatteryBar } from './BatteryBar'
import { FadeText } from './FadeText'
import { SpeedGauge } from './SpeedGauge'
import { SpeedReadout } from './SpeedReadout'
import './StatusCard.css'

const LOW_BATTERY = 20

interface Props {
  device: Device
  position: Position | null
}

export function StatusCard({ device, position }: Props) {
  const now = useNow()
  const { model, plate } = splitVehicleName(device.name)
  const lastSpeed = position ? knotsToKmh(position.speed) : null
  // Without a connection (or with an old fix) we do not know the speed: it is NOT zero, the vehicle may still
  // be moving. Show the last known value as history and never as a current reading.
  const offline = device.status === 'offline'
  const speed = position && hasCurrentSpeed(device.status, position.fixTime, now) ? lastSpeed : null
  const noDataLabel = offline ? 'Sin señal' : position ? 'Sin datos nuevos' : 'Sin datos'
  const battery = position?.attributes.batteryLevel ?? null
  const batteryLow = battery !== null && battery <= LOW_BATTERY
  const shownSpeed = useTweenedNumber(speed)
  const shownBattery = useTweenedNumber(battery)
  const announcement = useAnnouncement(device, speed, batteryLow)

  return (
    <section className="status-card status-card--enter" aria-labelledby="status-card-title">
      <header className="status-card__header">
        <h2 id="status-card-title" className="status-card__title">
          {model}
        </h2>
        {/* Label/value pairs, like the rest of the card: the labels are read by screen readers but not drawn. */}
        <dl className="status-card__badges">
          {plate && (
            <div>
              <dt className="visually-hidden">Placa</dt>
              <dd>
                <LicensePlate value={plate} />
              </dd>
            </div>
          )}
          <div>
            <dt className="visually-hidden">Estado de conexión</dt>
            <dd>
              <ConnectionIndicator status={device.status} />
            </dd>
          </div>
        </dl>
      </header>

      <dl className="status-card__data">
        <div className="status-card__row">
          <dt>Velocidad</dt>
          <dd className="status-card__value status-card__value--gauge">
            <SpeedGauge value={shownSpeed ?? 0}>
              <SpeedReadout speed={speed} shown={shownSpeed} lastSpeed={lastSpeed} noDataLabel={noDataLabel} />
            </SpeedGauge>
          </dd>
        </div>

        <div className="status-card__row">
          <dt>Batería</dt>
          <dd className={`status-card__value status-card__value--battery${batteryLow ? ' status-card__value--alert' : ''}`}>
            {battery === null ? (
              'No disponible'
            ) : (
              <>
                <BatteryBar level={shownBattery ?? battery} low={batteryLow} />
                <AnimatedValue value={battery}>{Math.round(shownBattery ?? battery)} %</AnimatedValue>
                {batteryLow && <span className="status-card__hint">Batería baja</span>}
              </>
            )}
          </dd>
        </div>

        <div className="status-card__row">
          <dt>
            <ClockIcon />
            Última actualización
          </dt>
          <dd className="status-card__value">
            {position ? (
              <time dateTime={position.fixTime}>
                <AnimatedValue value={position.fixTime}>
                  <FadeText text={formatRelative(position.fixTime, now)} />
                </AnimatedValue>
              </time>
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
    parts.push(speed === 0 ? 'vehículo detenido' : `velocidad ${speed} kilómetros por hora`)
    nextSpeed = speed
  }
  if (state.batteryLow !== batteryLow) parts.push(batteryLow ? 'batería baja' : 'batería recuperada')
  if (parts.length > 0) {
    setState({ deviceId: device.id, status: device.status, speed: nextSpeed, batteryLow, text: parts.join(', ') })
  }
  return state.text
}
