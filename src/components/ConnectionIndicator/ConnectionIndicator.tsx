import type { DeviceStatus } from '../../api'
import './ConnectionIndicator.css'

const LABELS: Record<DeviceStatus, string> = {
  online: 'En línea',
  offline: 'Sin conexión',
  unknown: 'Desconocido',
}

/** Status is always dot + text, never colour alone. */
export function ConnectionIndicator({ status }: { status: DeviceStatus }) {
  return (
    <span className={`connection connection--${status}`}>
      <span className="connection__dot" aria-hidden="true" />
      <span className="connection__label">{LABELS[status]}</span>
    </span>
  )
}

export const connectionLabel = (status: DeviceStatus): string => LABELS[status]
