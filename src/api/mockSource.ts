import type { Device, DeviceStatus, FeedHandlers, Position, TelemetrySource } from './types'

/** Local simulator so the UI can be built and demoed without a Traccar account. */

const TICK_MS = 2_000
const CENTER = { lat: 4.711, lng: -74.0721 }

interface Vehicle {
  device: Device
  radius: number
  phase: number
  angularSpeed: number
}

const vehicles: Vehicle[] = [
  { device: { id: 1, name: 'Camión 07', status: 'online', lastUpdate: null }, radius: 0.012, phase: 0, angularSpeed: 0.05 },
  { device: { id: 2, name: 'Furgón 12', status: 'online', lastUpdate: null }, radius: 0.02, phase: 2, angularSpeed: 0.035 },
  { device: { id: 3, name: 'Moto 03', status: 'offline', lastUpdate: null }, radius: 0.008, phase: 4, angularSpeed: 0.07 },
]

let tick = 0

function positionFor(vehicle: Vehicle): Position {
  const angle = vehicle.phase + tick * vehicle.angularSpeed
  const nextAngle = angle + 0.01
  const point = (a: number) => ({
    lat: CENTER.lat + Math.sin(a) * vehicle.radius,
    lng: CENTER.lng + Math.cos(a) * vehicle.radius * 1.3,
  })
  const now = point(angle)
  const next = point(nextAngle)
  const course = (Math.atan2(next.lng - now.lng, next.lat - now.lat) * 180) / Math.PI
  const speedKmh = 35 + Math.sin(tick * 0.3 + vehicle.phase) * 25
  return {
    id: vehicle.device.id * 1_000_000 + tick,
    deviceId: vehicle.device.id,
    latitude: now.lat,
    longitude: now.lng,
    speed: speedKmh / 1.852,
    course: (course + 360) % 360,
    fixTime: new Date().toISOString(),
    attributes: { batteryLevel: Math.max(5, Math.round(92 - tick * 0.4 - vehicle.phase * 3)) },
  }
}

export function createMockSource(): TelemetrySource {
  return {
    connect: () => new Promise((resolve) => setTimeout(resolve, 1_200)),
    getDevices: () => Promise.resolve(vehicles.map((v) => ({ ...v.device }))),
    getPositions: () => Promise.resolve(vehicles.map(positionFor)),
    subscribe(handlers: FeedHandlers) {
      handlers.onMode('live')
      const timer = setInterval(() => {
        tick += 1
        vehicles.forEach((vehicle) => {
          // Moto 03 flips connection state now and then to exercise the UI.
          if (vehicle.device.id === 3 && tick % 8 === 0) {
            const flipped: DeviceStatus = vehicle.device.status === 'offline' ? 'online' : 'offline'
            vehicle.device = { ...vehicle.device, status: flipped }
            handlers.onDevice(vehicle.device)
          }
          if (vehicle.device.status === 'online') handlers.onPosition(positionFor(vehicle))
        })
      }, TICK_MS)
      return () => clearInterval(timer)
    },
  }
}
