import { useMonitor } from '../../hooks/useMonitor'
import { useTheme } from '../../hooks/useTheme'
import { DeviceSelector } from '../DeviceSelector/DeviceSelector'
import { ErrorState } from '../ErrorState/ErrorState'
import { FeedStatus } from '../FeedStatus/FeedStatus'
import { VehicleMap } from '../Map/VehicleMap'
import { CardSkeleton, FeedSkeleton, MapSkeleton } from '../Skeleton/Skeleton'
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
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" className="app-shell__mark">
            <path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" fill="currentColor" />
          </svg>
          Rumbo
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
          <ErrorState
            kind={monitor.errorKind}
            onRetry={monitor.retry}
            onDemo={monitor.canToggleDemo ? monitor.enterDemo : undefined}
          />
        ) : (
          <>
            <div className="app-shell__stage">
              {phase === 'loading' ? (
                <FeedSkeleton />
              ) : (
                <FeedStatus
                  mode={monitor.mode}
                  lastFix={monitor.selectedPosition?.fixTime ?? null}
                  demo={monitor.isDemo}
                  onEnterDemo={monitor.canToggleDemo ? monitor.enterDemo : undefined}
                  onExitDemo={monitor.canToggleDemo && monitor.demoRequested ? monitor.exitDemo : undefined}
                />
              )}
              <div className="app-shell__map">
                {phase === 'loading' ? (
                  <MapSkeleton />
                ) : (
                  <VehicleMap device={monitor.selectedDevice} position={monitor.selectedPosition} />
                )}
              </div>
            </div>
            <div className="app-shell__panel">
              {phase === 'loading' && <CardSkeleton />}
              {phase === 'ready' && monitor.selectedDevice && (
                <StatusCard device={monitor.selectedDevice} position={monitor.selectedPosition} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
