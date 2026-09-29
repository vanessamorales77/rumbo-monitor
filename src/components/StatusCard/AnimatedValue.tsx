import { useEffect, useRef, type ReactNode } from 'react'
import { prefersReducedMotion } from '../../utils/motion'

interface Props {
  /** When this changes, the value gets a soft highlight. Children are never remounted. */
  value: string | number
  children?: ReactNode
}

/** Highlight eases in (~200ms) and fades out slowly (~1.4s): it guides the eye without flashing. */
export function AnimatedValue({ value, children }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(value)

  useEffect(() => {
    if (previous.current === value) return
    previous.current = value
    if (prefersReducedMotion()) return
    ref.current?.animate(
      [
        { backgroundColor: 'transparent', boxShadow: '0 0 0 4px transparent' },
        { offset: 0.14, backgroundColor: 'var(--color-highlight)', boxShadow: '0 0 0 4px var(--color-highlight)' },
        { backgroundColor: 'transparent', boxShadow: '0 0 0 4px transparent' },
      ],
      { duration: 1_400, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    )
  }, [value])

  return (
    <span ref={ref} className="animated-value">
      {children ?? value}
    </span>
  )
}
