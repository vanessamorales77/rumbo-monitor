import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ErrorState } from './ErrorState'

const meta = {
  title: 'Componentes/Estado de error',
  component: ErrorState,
  args: { onRetry: fn(), onDemo: fn() },
  parameters: {
    docs: {
      description: {
        component:
          'Mensaje empático con botón de reintento. Al aparecer, el foco pasa al título, que se describe con el texto del cuerpo (`aria-describedby`): se lee una sola vez. No usa `role="alert"` porque anunciaría el mensaje por duplicado.',
      },
    },
  },
} satisfies Meta<typeof ErrorState>

export default meta
type Story = StoryObj<typeof meta>

export const SinRed: Story = {
  name: 'Sin red',
  args: { kind: 'network', autoRetrySeconds: 15, onAutoRetry: fn() },
}
export const TiempoAgotado: Story = {
  name: 'Tiempo agotado',
  args: { kind: 'timeout', autoRetrySeconds: 15, onAutoRetry: fn() },
}
export const Credenciales: Story = {
  name: 'Credenciales rechazadas',
  args: { kind: 'auth' },
}
export const ErrorDelServidor: Story = {
  name: 'Error del servidor',
  args: { kind: 'server' },
}

/** Reinicia el mensaje cuando la cuenta llega a 0, como hace la aplicación al volver a intentar y volver a fallar. */
function CountdownLoop({ seconds }: { seconds: number }) {
  const [round, setRound] = useState(0)
  return <ErrorState key={round} kind="network" onRetry={() => setRound((n) => n + 1)} autoRetrySeconds={seconds} onAutoRetry={() => setRound((n) => n + 1)} takeFocus={false} />
}

export const CuentaAtrasCorta: Story = {
  name: 'Reintento automático (cuenta atrás de 6 s, en bucle)',
  args: { kind: 'network' },
  render: () => <CountdownLoop seconds={6} />,
  parameters: {
    docs: {
      description: {
        story:
          'El mensaje se reintenta solo tras 15 s (30 y 60 s si sigue fallando) con una cuenta atrás visible, y se puede detener (WCAG 2.2.1). Con credenciales rechazadas no hay reintento automático: no se arreglan solas. Los reintentos automáticos no roban el foco; el primer error sí lo recibe.',
      },
    },
  },
}
