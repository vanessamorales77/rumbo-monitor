import { createWalker, type LatLon, type Walker } from './routeWalker'
import type { Device, DeviceStatus, FeedHandlers, Position, TelemetrySource } from './types'

/** Local simulator so the UI can be built and demoed without a Traccar account.
 *  Vehicles follow real street routes (demoRoutes.json), same as scripts/simulate.ts. */

const TICK_MS = 2_000

interface Vehicle {
  device: Device
  routeId: string
  cruiseKmh: number
  start: number
  walker?: Walker
  distance: number
}

const vehicles: Vehicle[] = [
  { device: { id: 1, name: 'Chevrolet NPR · ABC-123', status: 'online', lastUpdate: null }, routeId: 'rumbo-npr-01', cruiseKmh: 34, start: 0, distance: 0 },
  { device: { id: 2, name: 'Renault Master · GHI-789', status: 'online', lastUpdate: null }, routeId: 'rumbo-master-03', cruiseKmh: 42, start: 0.35, distance: 0 },
  { device: { id: 3, name: 'Yamaha NMAX · PQR-98A', status: 'offline', lastUpdate: null }, routeId: 'rumbo-nmax-06', cruiseKmh: 30, start: 0.6, distance: 0 },
]

let tick = 0

async function loadRoutes() {
  const { default: routes } = (await import('./demoRoutes.json')) as unknown as { default: Record<string, LatLon[]> }
  for (const vehicle of vehicles) {
    if (vehicle.walker) continue
    vehicle.walker = createWalker(routes[vehicle.routeId])
    vehicle.distance = vehicle.walker.total * vehicle.start
  }
}

function positionFor(vehicle: Vehicle, advance: boolean): Position {
  const walker = vehicle.walker!
  const kmh = Math.max(8, vehicle.cruiseKmh + Math.sin(tick * 0.4 + vehicle.start * 10) * 10)
  if (advance) vehicle.distance += (kmh / 3.6) * (TICK_MS / 1000)
  const here = walker.at(vehicle.distance)
  return {
    id: vehicle.device.id * 1_000_000 + tick,
    deviceId: vehicle.device.id,
    latitude: here.lat,
    longitude: here.lon,
    speed: kmh / 1.852,
    course: here.bearing,
    fixTime: new Date().toISOString(),
    attributes: { batteryLevel: Math.max(5, 92 - tick) },
  }
}

export function createMockSource(): TelemetrySource {
  return {
    connect: async () => {
      await Promise.all([loadRoutes(), new Promise((resolve) => setTimeout(resolve, 1_200))])
    },
    getDevices: () => Promise.resolve(vehicles.map((v) => ({ ...v.device }))),
    getPositions: () => Promise.resolve(vehicles.map((v) => positionFor(v, false))),
    subscribe(handlers: FeedHandlers) {
      handlers.onMode('live')
      const timer = setInterval(() => {
        tick += 1
        vehicles.forEach((vehicle) => {
          // The motorbike flips connection state now and then to exercise the UI.
          if (vehicle.device.id === 3 && tick % 8 === 0) {
            const flipped: DeviceStatus = vehicle.device.status === 'offline' ? 'online' : 'offline'
            vehicle.device = { ...vehicle.device, status: flipped }
            handlers.onDevice(vehicle.device)
          }
          if (vehicle.device.status === 'online') handlers.onPosition(positionFor(vehicle, true))
        })
      }, TICK_MS)
      return () => clearInterval(timer)
    },
  }
}
