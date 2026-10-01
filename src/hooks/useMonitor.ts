import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createMockSource,
  createSource,
  isMockBuild,
  TelemetryError,
  type Device,
  type ErrorKind,
  type FeedMode,
  type Position,
} from '../api'

export type Phase = 'loading' | 'ready' | 'error'

/**
 * Owns the whole data lifecycle: connect → load devices + latest positions → live updates.
 * `retry()` re-runs the sequence from scratch.
 * `enterDemo()` swaps the real feed for the local simulator (always labelled as such in the UI);
 * `exitDemo()` goes back to Traccar.
 */
export function useMonitor() {
  const [demoRequested, setDemoRequested] = useState(false)
  const source = useMemo(() => (demoRequested ? createMockSource() : createSource()), [demoRequested])
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [positions, setPositions] = useState<Record<number, Position>>({})
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mode, setMode] = useState<FeedMode>('live')
  /** Failed attempts in a row: the automatic retry waits longer each time instead of hammering a server that is down. */
  const [failures, setFailures] = useState(0)
  /** The last retry came from the timer, not from a click: the screen must not steal the focus again. */
  const [retriedByTimer, setRetriedByTimer] = useState(false)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    const upsertDevice = (device: Device) =>
      setDevices((list) =>
        list.some((d) => d.id === device.id)
          ? list.map((d) => (d.id === device.id ? device : d))
          : [...list, device],
      )
    const upsertPosition = (position: Position) =>
      setPositions((map) => ({ ...map, [position.deviceId]: position }))

    async function start() {
      try {
        await source.connect()
        const [deviceList, positionList] = await Promise.all([source.getDevices(), source.getPositions()])
        if (cancelled) return
        setDevices(deviceList)
        setPositions(Object.fromEntries(positionList.map((p) => [p.deviceId, p])))
        setSelectedId((current) => current ?? deviceList[0]?.id ?? null)
        setPhase('ready')
        setFailures(0)
        unsubscribe = source.subscribe({ onDevice: upsertDevice, onPosition: upsertPosition, onMode: setMode })
      } catch (error) {
        if (cancelled) return
        setErrorKind(error instanceof TelemetryError ? error.kind : 'network')
        setFailures((n) => n + 1)
        setPhase('error')
      }
    }

    void start()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [source, attempt])

  const retryWith = useCallback((byTimer: boolean) => {
    setRetriedByTimer(byTimer)
    setPhase('loading')
    setErrorKind(null)
    setAttempt((n) => n + 1)
  }, [])
  const retry = useCallback(() => retryWith(false), [retryWith])
  const retryAutomatically = useCallback(() => retryWith(true), [retryWith])

  /** Seconds until the next automatic retry: 15, 30, then 60. Wrong credentials do not fix themselves, so no retry. */
  const autoRetrySeconds =
    phase === 'error' && errorKind !== null && errorKind !== 'auth' ? Math.min(60, 15 * 2 ** Math.max(0, failures - 1)) : null

  /** Start over with a different source: nothing from the previous one may linger on screen. */
  const switchSource = useCallback((demo: boolean) => {
    setPhase('loading')
    setErrorKind(null)
    setDevices([])
    setPositions({})
    setSelectedId(null)
    setMode('live')
    setFailures(0)
    setRetriedByTimer(false)
    setDemoRequested(demo)
  }, [])
  const enterDemo = useCallback(() => switchSource(true), [switchSource])
  const exitDemo = useCallback(() => switchSource(false), [switchSource])

  /** How the whole fleet is doing, independent of which vehicle is selected. */
  const fleet = useMemo(() => {
    const online = devices.filter((d) => d.status === 'online')
    let freshestFix: string | null = null
    for (const device of online) {
      const fix = positions[device.id]?.fixTime
      if (fix && (freshestFix === null || Date.parse(fix) > Date.parse(freshestFix))) freshestFix = fix
    }
    return { online: online.length, total: devices.length, freshestFix }
  }, [devices, positions])

  const selectedDevice = devices.find((d) => d.id === selectedId) ?? null
  const selectedPosition = selectedId === null ? null : (positions[selectedId] ?? null)

  return {
    phase,
    errorKind,
    devices,
    selectedId,
    selectedDevice,
    selectedPosition,
    mode,
    fleet,
    select: setSelectedId,
    retry,
    retryAutomatically,
    autoRetrySeconds,
    retriedByTimer,
    /** Data on screen is simulated (by the user's choice, or because the whole build is a mock). */
    isDemo: demoRequested || isMockBuild,
    /** The user can switch between real and simulated data (not in a build that is simulated throughout). */
    canToggleDemo: !isMockBuild,
    demoRequested,
    enterDemo,
    exitDemo,
  }
}
