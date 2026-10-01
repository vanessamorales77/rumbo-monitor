import './LicensePlate.css'

/** The plate as a plate: the visual vocabulary operators already read at a glance. */
export function LicensePlate({ value }: { value: string }) {
  return (
    <span className="license-plate">{value}</span>
  )
}
