import { createMockSource } from './mockSource'
import { createTraccarSource } from './traccarClient'
import type { TelemetrySource } from './types'

/**
 * Env:
 *   VITE_USE_MOCK        "true" → local simulator, no network
 *   VITE_TRACCAR_BASE    API origin; empty = same origin (proxy)
 *   VITE_TRACCAR_EMAIL / VITE_TRACCAR_PASSWORD   demo account
 */
export function createSource(): TelemetrySource {
  const env = import.meta.env
  if (isMockBuild) return createMockSource()
  return createTraccarSource({
    baseUrl: env.VITE_TRACCAR_BASE ?? '',
    email: env.VITE_TRACCAR_EMAIL ?? '',
    password: env.VITE_TRACCAR_PASSWORD ?? '',
  })
}

/** True when the whole build runs on simulated data (VITE_USE_MOCK). */
export const isMockBuild = import.meta.env.VITE_USE_MOCK === 'true'

export { createMockSource }
export * from './types'
