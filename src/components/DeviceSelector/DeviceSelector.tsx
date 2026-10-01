import type { Device } from '../../api'
import './DeviceSelector.css'

interface Props {
  devices: Device[]
  selectedId: number | null
  onSelect: (id: number) => void
  disabled?: boolean
  /** Vehicles are still being fetched: say so instead of "Sin datos". */
  loading?: boolean
}

/** Native <select>: keyboard, screen reader and mobile pickers for free. */
export function DeviceSelector({ devices, selectedId, onSelect, disabled, loading }: Props) {
  return (
    <div className="device-selector">
      <label htmlFor="device-select" className="visually-hidden">
        Vehículo
      </label>
      <select
        id="device-select"
        className="device-selector__select"
        value={selectedId ?? ''}
        disabled={disabled || devices.length === 0}
        onChange={(event) => onSelect(Number(event.target.value))}
      >
        {devices.length === 0 && <option value="">{loading ? 'Cargando vehículos…' : 'Sin datos'}</option>}
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.name}
          </option>
        ))}
      </select>
      <span className="device-selector__chevron" aria-hidden="true" />
    </div>
  )
}
