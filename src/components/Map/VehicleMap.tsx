import { useEffect, useId, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Device, Position } from '../../api'
import { useNow } from '../../hooks/useNow'
import { connectionLabel, hasCurrentSpeed } from '../../utils/status'
import { knotsToKmh } from '../../utils/units'
import { MapSkeleton } from '../Skeleton/Skeleton'
import { useVehicleMarker } from './useVehicleMarker'
import './VehicleMap.css'

/** Must match the fade-out duration of `.skeleton--leaving`. */
const COVER_FADE_MS = 350

interface Props {
  device: Device | null
  position: Position | null
}

export function VehicleMap({ device, position }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hintId = useId()

  const now = useNow(10_000)
  // Same rule as the status card: a missing or old speed is history, not a reading, so leave it out of the name.
  const moving = device && position && hasCurrentSpeed(device.status, position.fixTime, now)
  const label = device
    ? `${device.name}, ${connectionLabel(device.status)}${
        moving ? `, ${knotsToKmh(position.speed)} kilómetros por hora, rumbo ${Math.round(position.course)} grados` : ''
      }`
    : 'Vehículo'

  const { mapReady } = useVehicleMarker({
    containerRef,
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
    course: position?.course ?? 0,
    status: device?.status ?? 'unknown',
    label,
    snapKey: device?.id ?? null,
    fixTime: position?.fixTime ?? null,
  })

  // The loading cover (same look as the skeleton before it) stays until the tiles around the vehicle have loaded,
  // then fades out: the map never shows up half-painted.
  const [covered, setCovered] = useState(true)
  useEffect(() => {
    if (!mapReady) return
    const timer = window.setTimeout(() => setCovered(false), COVER_FADE_MS)
    return () => window.clearTimeout(timer)
  }, [mapReady])

  return (
    <>
      <div
        ref={containerRef}
        className="vehicle-map"
        role="region"
        aria-label="Mapa de ubicación del vehículo"
        aria-describedby={hintId}
      />
      <p id={hintId} className="visually-hidden">
        El mapa se mantiene centrado en el vehículo. Con el mapa enfocado, las flechas mueven la vista y vuelve al vehículo con
        la siguiente posición. Los botones Acercar y Alejar funcionan con Enter y Espacio.
      </p>
      {covered && <MapSkeleton leaving={mapReady} />}
    </>
  )
}
