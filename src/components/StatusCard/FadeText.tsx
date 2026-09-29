import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../../utils/motion'

/** Text that crossfades (with a 3px drift) whenever its content changes. */
export function FadeText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(text)

  useEffect(() => {
    if (previous.current === text) return
    previous.current = text
    if (prefersReducedMotion()) return
    ref.current?.animate(
      [
        { opacity: 0, transform: 'translateY(3px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    )
  }, [text])

  return (
    <span ref={ref} className="fade-text">
      {text}
    </span>
  )
}
