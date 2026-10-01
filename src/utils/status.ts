import type { DeviceStatus } from '../api'

const LABELS: Record<DeviceStatus, string> = {
  online: 'En línea',
  offline: 'Sin conexión',
  unknown: 'Desconocido',
}

/** A position older than this, on a feed that looks connected, counts as "no new data". */
const STALE_AFTER_MS = 2 * 60_000

export const isStale = (fixTime: string, now: number): boolean => now - Date.parse(fixTime) > STALE_AFTER_MS

export const connectionLabel = (status: DeviceStatus): string => LABELS[status]
