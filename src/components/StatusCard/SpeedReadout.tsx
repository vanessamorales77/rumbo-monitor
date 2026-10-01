import { AnimatedValue } from './AnimatedValue'

interface Props {
  /** Current speed in km/h, or null when it is unknown (offline vehicle, old fix, no position). */
  speed: number | null
  /** The same speed, eased by the caller for display. */
  shown: number | null
  /** Last speed we ever received, shown as history when `speed` is null. */
  lastSpeed: number | null
  /** What to say when there is no current speed ("Sin señal", "Sin datos nuevos"...). */
  noDataLabel: string
}

/** The text in the middle of the speed gauge. A missing speed is never shown as 0: the vehicle may still be moving. */
export function SpeedReadout({ speed, shown, lastSpeed, noDataLabel }: Props) {
  return (
    <span key={speed === null ? 'no-data' : 'speed'} className="speed-gauge__readout">
      {speed === null ? (
        <>
          <span className="speed-gauge__headline">{noDataLabel}</span>
          {lastSpeed !== null && <span className="speed-gauge__note">Última: {lastSpeed} km/h</span>}
        </>
      ) : (
        <>
          <AnimatedValue value={speed}>
            <span className="status-card__number">{Math.round(shown ?? speed)}</span>
            <span className="status-card__unit">km/h</span>
          </AnimatedValue>
          {speed === 0 && <span className="speed-gauge__note">Detenido</span>}
        </>
      )}
    </span>
  )
}
