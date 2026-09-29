import type { Device } from '../../api'
import './DeviceSelector.css'

interface Props {
  devices: Device[]
  selectedId: number | null
  onSelect: (id: number) => void
  disabled?: boolean
}

/** Native <select>: keyboard, screen reader and mobile pickers for free. */
export function DeviceSelector({ devices, selectedId, onSelect, disabled }: Props) {
  return (
    <div className="device-selector">
      <label htmlFor="device-select" className="device-selector__label">
        Vehículo
      </label>
      <select
        id="device-select"
        className="device-selector__select"
        value={selectedId ?? ''}
        disabled={disabled || devices.length === 0}
        onChange={(event) => onSelect(Number(event.target.value))}
      >
        {devices.length === 0 && <option value="">Sin vehículos</option>}
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.name}
          </option>
        ))}
      </select>
    </div>
  )
}
