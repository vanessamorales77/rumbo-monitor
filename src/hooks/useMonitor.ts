import { useCallback, useEffect, useMemo, useState } from 'react'
import { createSource, TelemetryError, type Device, type ErrorKind, type FeedMode, type Position } from '../api'

export type Phase = 'loading' | 'ready' | 'error'

/**
 * Owns the whole data lifecycle: connect → load devices + latest positions → live updates.
 * `retry()` re-runs the sequence from scratch.
 */
export function useMonitor() {
  const source = useMemo(() => createSource(), [])
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [positions, setPositions] = useState<Record<number, Position>>({})
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mode, setMode] = useState<FeedMode>('live')

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
        unsubscribe = source.subscribe({ onDevice: upsertDevice, onPosition: upsertPosition, onMode: setMode })
      } catch (error) {
        if (cancelled) return
        setErrorKind(error instanceof TelemetryError ? error.kind : 'network')
        setPhase('error')
      }
    }

    void start()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [source, attempt])

  const retry = useCallback(() => {
    setPhase('loading')
    setErrorKind(null)
    setAttempt((n) => n + 1)
  }, [])

  const selectedDevice = devices.find((d) => d.id === selectedId) ?? null
  const selectedPosition = selectedId === null ? null : (positions[selectedId] ?? null)

  return { phase, errorKind, devices, selectedId, selectedDevice, selectedPosition, mode, select: setSelectedId, retry }
}
