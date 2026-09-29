import { useMonitor } from '../../hooks/useMonitor'
import { useTheme } from '../../hooks/useTheme'
import { DeviceSelector } from '../DeviceSelector/DeviceSelector'
import { ErrorState } from '../ErrorState/ErrorState'
import { VehicleMap } from '../Map/VehicleMap'
import { CardSkeleton, MapSkeleton } from '../Skeleton/Skeleton'
import { StatusCard } from '../StatusCard/StatusCard'
import { ThemeToggle } from '../ThemeToggle/ThemeToggle'
import './AppShell.css'

export function AppShell() {
  const { theme, toggle } = useTheme()
  const monitor = useMonitor()
  const { phase } = monitor

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>

      <header className="app-shell__bar">
        <h1 className="app-shell__brand">
          Rumbo <span>Monitor de flota</span>
        </h1>
        <div className="app-shell__controls">
          <DeviceSelector
            devices={monitor.devices}
            selectedId={monitor.selectedId}
            onSelect={monitor.select}
            disabled={phase !== 'ready'}
          />
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      <main id="main" className="app-shell__main" aria-busy={phase === 'loading'}>
        {phase === 'error' && monitor.errorKind ? (
          <ErrorState kind={monitor.errorKind} onRetry={monitor.retry} />
        ) : (
          <>
            <div className="app-shell__map">
              {phase === 'loading' ? <MapSkeleton /> : <VehicleMap device={monitor.selectedDevice} position={monitor.selectedPosition} />}
            </div>
            <div className="app-shell__panel">
              {phase === 'loading' && (
                <>
                  <p className="visually-hidden" role="status">
                    Cargando datos del vehículo…
                  </p>
                  <CardSkeleton />
                </>
              )}
              {phase === 'ready' && monitor.selectedDevice && (
                <StatusCard device={monitor.selectedDevice} position={monitor.selectedPosition} mode={monitor.mode} />
              )}
              {phase === 'ready' && !monitor.selectedDevice && (
                <p className="app-shell__empty">Selecciona un vehículo para comenzar.</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
