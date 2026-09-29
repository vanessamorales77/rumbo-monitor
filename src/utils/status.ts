import type { DeviceStatus } from '../api'

const LABELS: Record<DeviceStatus, string> = {
  online: 'En línea',
  offline: 'Sin conexión',
  unknown: 'Desconocido',
}

export const connectionLabel = (status: DeviceStatus): string => LABELS[status]
