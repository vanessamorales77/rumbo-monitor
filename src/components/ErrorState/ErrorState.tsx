import { useEffect, useRef } from 'react'
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
}

export function ErrorState({ kind, onRetry, onDemo }: Props) {
  const { title, body } = COPY[kind]
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Move focus to the message so keyboard and screen-reader users land on it.
  useEffect(() => headingRef.current?.focus(), [])

  return (
    <section className="error-state" role="alert" aria-labelledby="error-title">
      <span className="error-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28" focusable="false">
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8.8a15 15 0 0 1 4-2.6M22 8.8a15 15 0 0 0-8-3.7M5 12.9a10 10 0 0 1 3.2-2M19 12.9a10 10 0 0 0-3-2M8.5 16.4a5 5 0 0 1 7 0" />
            <path d="M12 20h.01M3 3l18 18" />
          </g>
        </svg>
      </span>
      <h2 id="error-title" ref={headingRef} tabIndex={-1} className="error-state__title">
        {title}
      </h2>
      <p className="error-state__body">{body}</p>
      <button type="button" className="error-state__retry" onClick={onRetry}>
        Reintentar
      </button>
      {onDemo && (
        <button type="button" className="error-state__secondary" onClick={onDemo}>
          Ver modo demostración
        </button>
      )}
    </section>
  )
}
