import type { Device, Position } from '../api'
import { KNOTS_TO_KMH } from '../utils/units'

/** Sample data shared by the Storybook stories. */

export const makeDevice = (overrides: Partial<Device> = {}): Device => ({
  id: 1,
  name: 'Chevrolet NPR · ABC-123',
  status: 'online',
  lastUpdate: null,
  ...overrides,
})

interface PositionOptions {
  speedKmh?: number
  battery?: number | null
  course?: number
  /** How long ago the fix was taken. */
  ageSeconds?: number
  latitude?: number
  longitude?: number
}

export const makePosition = ({
  speedKmh = 34,
  battery = 79,
  course = 45,
  ageSeconds = 3,
  latitude = 4.711,
  longitude = -74.0721,
}: PositionOptions = {}): Position => ({
  id: 1,
  deviceId: 1,
  latitude,
  longitude,
  speed: speedKmh / KNOTS_TO_KMH,
  course,
  fixTime: new Date(Date.now() - ageSeconds * 1000).toISOString(),
  attributes: battery === null ? {} : { batteryLevel: battery },
})

export const sampleDevices: Device[] = [
  makeDevice({ id: 1, name: 'Chevrolet NPR · ABC-123' }),
  makeDevice({ id: 2, name: 'Renault Master · GHI-789' }),
  makeDevice({ id: 3, name: 'Yamaha NMAX · PQR-98A', status: 'offline' }),
]
