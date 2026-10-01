import { useEffect, useRef, useState } from 'react'
import type { ErrorKind } from '../../api'
import './ErrorState.css'

const COPY: Record<ErrorKind, { title: string; body: string }> = {
  network: {
    title: 'No pudimos conectar con el servidor',
    body: 'Puede ser un corte de internet o que el servidor de Traccar esté fuera de servicio. Revisa tu conexión e inténtalo de nuevo.',
  },
  timeout: {
    title: 'El servidor tardó demasiado en responder',
    body: 'Traccar no contestó a tiempo. Suele resolverse en unos segundos.',
  },
  auth: {
    title: 'No pudimos iniciar sesión',
    body: 'El servidor rechazó las credenciales configuradas. Revisa el usuario y la contraseña de la cuenta de Traccar.',
  },
  server: {
    title: 'El servidor tuvo un problema',
    body: 'Traccar respondió con un error inesperado. Tus datos no se perdieron; vuelve a intentarlo.',
  },
}

interface Props {
  kind: ErrorKind
  onRetry: () => void
  /** When provided, offers to look at the app with simulated data meanwhile. */
  onDemo?: () => void
  /** Seconds until the screen retries by itself (null/undefined: it does not, e.g. wrong credentials). */
  autoRetrySeconds?: number | null
  onAutoRetry?: () => void
  /** Move the focus to the message. False when this is an automatic retry: it must not pull the focus every few seconds. */
  takeFocus?: boolean
}

export function ErrorState({ kind, onRetry, onDemo, autoRetrySeconds, onAutoRetry, takeFocus = true }: Props) {
  const { title, body } = COPY[kind]
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Move focus to the message so keyboard and screen-reader users land on it. No role="alert":
  // that would announce the same text a second time. The heading is described by the body.
  useEffect(() => {
    if (takeFocus) headingRef.current?.focus()
  }, [takeFocus])

  // A control room cannot wait for someone to press a button: the screen retries by itself, and says so.
  // The countdown can be stopped (WCAG 2.2.1: a time limit the user can turn off).
  const [left, setLeft] = useState(autoRetrySeconds ?? 0)
  const [stopped, setStopped] = useState(false)
  const counting = autoRetrySeconds != null && onAutoRetry !== undefined && !stopped
  useEffect(() => {
    if (!counting) return
    const timer = window.setInterval(() => setLeft((n) => n - 1), 1_000)
    return () => window.clearInterval(timer)
  }, [counting])
  useEffect(() => {
    if (counting && left <= 0) onAutoRetry?.()
  }, [counting, left, onAutoRetry])

  return (
    <section className="error-state" aria-labelledby="error-title">
      {/* The app's own vehicle marker (same geometry as the map's), with the dashed "offline" ring and its arrow knocked
          off course: a vehicle that has lost its bearing ("rumbo"). */}
      <span className="error-state__icon" aria-hidden="true">
        <svg viewBox="0 0 56 56" width="72" height="72" focusable="false">
          <circle className="error-state__halo" cx="28" cy="28" r="26" />
          <circle className="error-state__ring" cx="28" cy="28" r="17" pathLength="100" />
          <path className="error-state__arrow" d="M28 14 L37 39 L28 33 L19 39 Z" transform="rotate(-28 28 28)" />
        </svg>
      </span>
      <h2 id="error-title" ref={headingRef} tabIndex={-1} aria-describedby="error-body" className="error-state__title">
        {title}
      </h2>
      <p id="error-body" className="error-state__body">
        {body}
      </p>
      <button type="button" className="error-state__retry" onClick={onRetry}>
        Reintentar
      </button>
      {onDemo && (
        <button type="button" className="error-state__secondary" onClick={onDemo}>
          Ver modo demostración
        </button>
      )}
      {autoRetrySeconds != null && onAutoRetry && (
        <div className="error-state__auto">
          {counting ? (
            <>
              {/* The ticking text is for the eyes; screen readers get one calm sentence instead of a message per second. */}
              <p className="visually-hidden" role="status">
                Reintentaremos automáticamente en {autoRetrySeconds} segundos.
              </p>
              <p className="error-state__countdown" aria-hidden="true">
                Reintentando automáticamente en {Math.max(left, 0)} s
              </p>
              <span className="error-state__track" aria-hidden="true">
                <span className="error-state__progress" style={{ animationDuration: `${autoRetrySeconds}s` }} />
              </span>
            </>
          ) : (
            <p className="error-state__countdown">Reintento automático detenido.</p>
          )}
          <button
            type="button"
            className="error-state__link"
            onClick={() => {
              setLeft(autoRetrySeconds)
              setStopped((value) => !value)
            }}
          >
            {counting ? 'Detener' : 'Reanudar'}
          </button>
        </div>
      )}
    </section>
  )
}
