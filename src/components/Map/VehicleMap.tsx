import { useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Device, Position } from '../../api'
import { connectionLabel } from '../../utils/status'
import { knotsToKmh } from '../../utils/units'
import { useVehicleMarker } from './useVehicleMarker'
import './VehicleMap.css'

interface Props {
  device: Device | null
  position: Position | null
}

export function VehicleMap({ device, position }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // An offline vehicle's last speed is history, not a reading: leave it out of the name.
  const moving = position && device?.status !== 'offline'
  const label = device
    ? `${device.name}, ${connectionLabel(device.status)}${
        moving ? `, ${knotsToKmh(position.speed)} kilómetros por hora, rumbo ${Math.round(position.course)} grados` : ''
      }`
    : 'Vehículo'

  const { following, recenter } = useVehicleMarker({
    containerRef,
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
    course: position?.course ?? 0,
    status: device?.status ?? 'unknown',
    label,
    snapKey: device?.id ?? null,
  })

  return (
    <>
      <div ref={containerRef} className="vehicle-map" role="region" aria-label="Mapa de ubicación del vehículo" />
      {!following && (
        <button
          type="button"
          className="vehicle-map__recenter"
          onClick={() => {
            recenter()
            // The button is about to disappear: keep keyboard users on the map instead of losing focus.
            containerRef.current?.focus()
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
            <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </g>
          </svg>
          <span className="vehicle-map__recenter-label">Recentrar en el vehículo</span>
        </button>
      )}
    </>
  )
}
