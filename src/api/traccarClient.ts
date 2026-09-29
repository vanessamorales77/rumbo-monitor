import {
  TelemetryError,
  type Device,
  type FeedHandlers,
  type Position,
  type TelemetrySource,
} from './types'

const REQUEST_TIMEOUT_MS = 10_000
const POLL_INTERVAL_MS = 5_000
const WS_RETRY_MS = 15_000

interface TraccarConfig {
  /** Empty string = same origin (Vite proxy in dev, rewrite/Worker in prod). */
  baseUrl: string
  email: string
  password: string
}

interface RawDevice {
  id: number
  name: string
  status?: string
  lastUpdate?: string | null
}

const toDevice = (raw: RawDevice): Device => ({
  id: raw.id,
  name: raw.name,
  status: raw.status === 'online' || raw.status === 'offline' ? raw.status : 'unknown',
  lastUpdate: raw.lastUpdate ?? null,
})

export function createTraccarSource(config: TraccarConfig): TelemetrySource {
  const { baseUrl, email, password } = config

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        credentials: 'include',
        signal: controller.signal,
        headers: { Accept: 'application/json', ...init.headers },
      })
      if (response.status === 401 || response.status === 403) {
        throw new TelemetryError('auth', 'Traccar rejected the credentials')
      }
      if (!response.ok) {
        throw new TelemetryError('server', `Traccar responded ${response.status}`)
      }
      return (await response.json()) as T
    } catch (error) {
      if (error instanceof TelemetryError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TelemetryError('timeout', 'Traccar took too long to respond')
      }
      throw new TelemetryError('network', 'Could not reach Traccar')
    } finally {
      clearTimeout(timer)
    }
  }

  const socketUrl = () => {
    const origin = baseUrl || window.location.origin
    return `${origin.replace(/^http/, 'ws')}/api/socket`
  }

  return {
    async connect() {
      await request('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email, password }),
      })
    },

    async getDevices() {
      return (await request<RawDevice[]>('/api/devices')).map(toDevice)
    },

    getPositions() {
      return request<Position[]>('/api/positions')
    },

    /** WebSocket first; if it drops, poll every 5 s while retrying the socket in the background. */
    subscribe(handlers: FeedHandlers) {
      let socket: WebSocket | null = null
      let pollTimer: ReturnType<typeof setInterval> | undefined
      let retryTimer: ReturnType<typeof setTimeout> | undefined
      let disposed = false

      const startPolling = () => {
        handlers.onMode('polling')
        if (pollTimer) return
        pollTimer = setInterval(() => {
          request<Position[]>('/api/positions')
            .then((positions) => positions.forEach(handlers.onPosition))
            .catch(() => undefined)
        }, POLL_INTERVAL_MS)
      }

      const stopPolling = () => {
        clearInterval(pollTimer)
        pollTimer = undefined
      }

      const open = () => {
        if (disposed) return
        try {
          socket = new WebSocket(socketUrl())
        } catch {
          startPolling()
          retryTimer = setTimeout(open, WS_RETRY_MS)
          return
        }
        socket.onopen = () => {
          stopPolling()
          handlers.onMode('live')
        }
        socket.onmessage = (event) => {
          const data = JSON.parse(event.data as string) as {
            devices?: RawDevice[]
            positions?: Position[]
          }
          data.devices?.map(toDevice).forEach(handlers.onDevice)
          data.positions?.forEach(handlers.onPosition)
        }
        socket.onclose = () => {
          if (disposed) return
          startPolling()
          retryTimer = setTimeout(open, WS_RETRY_MS)
        }
      }

      open()

      return () => {
        disposed = true
        clearTimeout(retryTimer)
        stopPolling()
        socket?.close()
      }
    },
  }
}
