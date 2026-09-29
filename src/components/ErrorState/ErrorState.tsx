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

export function ErrorState({ kind, onRetry }: { kind: ErrorKind; onRetry: () => void }) {
  const { title, body } = COPY[kind]
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Move focus to the message so keyboard and screen-reader users land on it.
  useEffect(() => headingRef.current?.focus(), [])

  return (
    <section className="error-state" role="alert" aria-labelledby="error-title">
      <svg className="error-state__icon" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false">
        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M32 18v18M32 44v2" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <h2 id="error-title" ref={headingRef} tabIndex={-1} className="error-state__title">
        {title}
      </h2>
      <p className="error-state__body">{body}</p>
      <button type="button" className="error-state__retry" onClick={onRetry}>
        Reintentar
      </button>
    </section>
  )
}
