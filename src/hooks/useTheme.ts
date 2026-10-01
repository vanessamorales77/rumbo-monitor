import { useCallback, useEffect, useState } from 'react'

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

const systemTheme = (): Theme => (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light')

/**
 * The theme follows the operating system until the user picks one with the switch; only that explicit choice is
 * remembered. (Saving the system's default as if it were a choice would freeze the app on it forever.)
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    // The browser's own bar (mobile address bar, installed-app title bar) takes the colour of the app's header.
    const surface = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface)
  }, [theme])

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      if (storedTheme() === null) setTheme(event.matches ? 'dark' : 'light')
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage blocked: the choice still applies for this visit */
    }
  }, [theme])

  return { theme, toggle }
}
