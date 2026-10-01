import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { prefersReducedMotion } from '../utils/motion'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'rumbo-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

/** The theme the user chose on purpose, if any. Storage can be blocked: then there simply is none. */
function storedTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

/** Paints a theme: the attribute that drives every colour token, and the colour of the browser's own bar. */
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  // The browser's own bar (mobile address bar, installed-app title bar) takes the colour of the app's header.
  const surface = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface)
}

const systemTheme = (): Theme => (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light')

/**
 * The theme follows the operating system until the user picks one with the switch; only that explicit choice is
 * remembered. (Saving the system's default as if it were a choice would freeze the app on it forever.)
 *
 * Switching cross-fades the whole page with the View Transitions API (no-op where it does not exist, or with reduced
 * motion). The transition runs its callback LATER, after taking a snapshot, so the callback reads the latest theme that
 * was asked for instead of the one it was created with: two quick clicks can never leave the page out of step.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme())
  const requested = useRef(theme)

  // Layout effect: it must have painted the new theme by the time the transition takes its "after" snapshot.
  useLayoutEffect(() => applyTheme(theme), [theme])

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      if (storedTheme() === null) {
        requested.current = event.matches ? 'dark' : 'light'
        setTheme(requested.current)
      }
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    requested.current = requested.current === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(STORAGE_KEY, requested.current)
    } catch {
      /* storage blocked: the choice still applies for this visit */
    }
    const commit = () => flushSync(() => setTheme(requested.current))
    if ('startViewTransition' in document && !prefersReducedMotion()) document.startViewTransition(commit)
    else commit()
  }, [])

  return { theme, toggle }
}
