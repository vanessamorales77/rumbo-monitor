import { useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Device, Position } from '../../api'
import { connectionLabel } from '../ConnectionIndicator/ConnectionIndicator'
import { knotsToKmh } from '../../utils/units'
import { useVehicleMarker } from './useVehicleMarker'
import './VehicleMap.css'

interface Props {
  device: Device | null
  position: Position | null
}

export function VehicleMap({ device, position }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const label = device
    ? `${device.name}, ${connectionLabel(device.status)}${
        position ? `, ${knotsToKmh(position.speed)} kilómetros por hora, rumbo ${Math.round(position.course)} grados` : ''
      }`
    : 'Vehículo'

  useVehicleMarker({
    containerRef,
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
    course: position?.course ?? 0,
    status: device?.status ?? 'unknown',
    label,
  })

  return <div ref={containerRef} className="vehicle-map" role="region" aria-label="Mapa de ubicación del vehículo" />
}
