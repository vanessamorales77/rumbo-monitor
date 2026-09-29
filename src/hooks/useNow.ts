import { useEffect, useState } from 'react'

/** Re-renders every `intervalMs` so relative timestamps ("Hace 12 s") stay fresh. */
export function useNow(intervalMs = 1_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
