import { useMonitor } from '../../hooks/useMonitor'
import { useTheme } from '../../hooks/useTheme'
import { BrandMark } from '../BrandMark/BrandMark'
import { DeviceSelector } from '../DeviceSelector/DeviceSelector'
import { ErrorState } from '../ErrorState/ErrorState'
import { FeedStatus } from '../FeedStatus/FeedStatus'
import { FleetSummary } from '../FleetSummary/FleetSummary'
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
          <span className="app-shell__mark">
            <BrandMark size={26} />
          </span>
          Rumbo
        </h1>
        <div className="app-shell__controls">
          {phase === 'ready' && (
            <FleetSummary className="app-shell__fleet" online={monitor.fleet.online} total={monitor.fleet.total} />
          )}
          <DeviceSelector
            devices={monitor.devices}
            selectedId={monitor.selectedId}
            onSelect={monitor.select}
            disabled={phase !== 'ready'}
            loading={phase === 'loading'}
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
                  onlineCount={monitor.fleet.online}
                  totalCount={monitor.fleet.total}
                  lastFix={monitor.fleet.freshestFix}
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
