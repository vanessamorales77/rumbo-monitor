import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../utils/motion'

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Eases the displayed number from its current value to `target` instead of jumping.
 * Interrupted tweens restart from wherever they were, so rapid updates never snap.
 */
export function useTweenedNumber(target: number | null, durationMs = 700): number | null {
  const [display, setDisplay] = useState<number | null>(target)
  const current = useRef<number | null>(target)
  const frame = useRef(0)

  useEffect(() => {
    cancelAnimationFrame(frame.current)
    const from = current.current
    const skip = target === null || from === null || from === target || prefersReducedMotion()
    const begin = performance.now()

    const step = (now: number) => {
      const t = skip ? 1 : Math.min(1, (now - begin) / durationMs)
      const value = skip ? target : from! + (target! - from!) * easeOutCubic(t)
      current.current = value
      setDisplay(value)
      if (t < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [target, durationMs])

  return display
}
