export type DeviceStatus = 'online' | 'offline' | 'unknown'

export interface Device {
  id: number
  name: string
  status: DeviceStatus
  lastUpdate: string | null
}

export interface Position {
  id: number
  deviceId: number
  latitude: number
  longitude: number
  /** Speed in knots, as returned by Traccar. */
  speed: number
  /** Heading in degrees, 0 = north. */
  course: number
  fixTime: string
  attributes: { batteryLevel?: number }
}

/** How live data is currently arriving. */
export type FeedMode = 'live' | 'polling'

export interface FeedHandlers {
  onDevice: (device: Device) => void
  onPosition: (position: Position) => void
  onMode: (mode: FeedMode) => void
}

export type ErrorKind = 'auth' | 'network' | 'server' | 'timeout'

export class TelemetryError extends Error {
  readonly kind: ErrorKind

  constructor(kind: ErrorKind, message: string) {
    super(message)
    this.name = 'TelemetryError'
    this.kind = kind
  }
}

/** Anything that can feed the monitor: the real Traccar API or the local simulator. */
export interface TelemetrySource {
  connect: () => Promise<void>
  getDevices: () => Promise<Device[]>
  getPositions: () => Promise<Position[]>
  subscribe: (handlers: FeedHandlers) => () => void
}
