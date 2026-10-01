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
/** Consecutive failed polls before the feed is reported as lost (~10 s). */
const LOST_AFTER_FAILURES = 2

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

  let signingIn: Promise<void> | undefined
  /** Concurrent callers share one sign-in. */
  const signIn = () => {
    signingIn ??= request<unknown>('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password }),
    })
      .then(() => undefined)
      .finally(() => {
        signingIn = undefined
      })
    return signingIn
  }

  /** The session cookie can expire mid-shift: on a 401, sign in again once and retry. */
  async function authed<T>(path: string): Promise<T> {
    try {
      return await request<T>(path)
    } catch (error) {
      if (!(error instanceof TelemetryError) || error.kind !== 'auth') throw error
      await signIn()
      return request<T>(path)
    }
  }

  return {
    connect: signIn,

    async getDevices() {
      return (await authed<RawDevice[]>('/api/devices')).map(toDevice)
    },

    getPositions() {
      return authed<Position[]>('/api/positions')
    },

    /** WebSocket first; if it drops, poll every 5 s while retrying the socket in the background.
     *  Polling that keeps failing is reported as 'lost' so the UI can warn that data is stale. */
    subscribe(handlers: FeedHandlers) {
      let socket: WebSocket | null = null
      let pollTimer: ReturnType<typeof setInterval> | undefined
      let retryTimer: ReturnType<typeof setTimeout> | undefined
      let disposed = false
      let polling = false
      let failures = 0

      const poll = async () => {
        if (polling) return
        polling = true
        try {
          const [devices, positions] = await Promise.all([
            authed<RawDevice[]>('/api/devices'),
            authed<Position[]>('/api/positions'),
          ])
          if (disposed || pollTimer === undefined) return
          failures = 0
          devices.map(toDevice).forEach(handlers.onDevice)
          positions.forEach(handlers.onPosition)
          handlers.onMode('polling')
        } catch {
          // Polling was stopped (socket back, or disposed) while this request was in flight: not a failure.
          if (disposed || pollTimer === undefined) return
          failures += 1
          if (failures >= LOST_AFTER_FAILURES) handlers.onMode('lost')
        } finally {
          polling = false
        }
      }

      const startPolling = () => {
        if (pollTimer) return
        handlers.onMode('polling')
        pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS)
        void poll()
      }

      const stopPolling = () => {
        clearInterval(pollTimer)
        pollTimer = undefined
        failures = 0
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
          let data: { devices?: RawDevice[]; positions?: Position[] }
          try {
            data = JSON.parse(event.data as string)
          } catch {
            return // a malformed frame must not take the feed down
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
