import type { DeviceStatus } from '../../api'
import { connectionLabel } from '../../utils/status'
import { AnimatedValue } from '../StatusCard/AnimatedValue'
import { FadeText } from '../StatusCard/FadeText'
import './ConnectionIndicator.css'

/** Status pill. Always dot + text, never colour alone. A change of state is signalled by colour, a fade and a soft highlight. */
export function ConnectionIndicator({ status }: { status: DeviceStatus }) {
  return (
    <span className={`connection connection--${status}`}>
      <span className="connection__dot" aria-hidden="true" />
      <span className="connection__label">
        <AnimatedValue value={status}>
          <FadeText text={connectionLabel(status)} />
        </AnimatedValue>
      </span>
    </span>
  )
}
