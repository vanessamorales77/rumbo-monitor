import type { DeviceStatus } from '../../api'
import { connectionLabel } from '../../utils/status'
import './ConnectionIndicator.css'

/** Status pill. Always dot + text, never colour alone. */
export function ConnectionIndicator({ status }: { status: DeviceStatus }) {
  return (
    <span className={`connection connection--${status}`}>
      <span className="connection__dot" aria-hidden="true" />
      <span className="connection__label">{connectionLabel(status)}</span>
    </span>
  )
}
