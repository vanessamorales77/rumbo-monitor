import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { DeviceStatus } from '../../api'
import { ConnectionIndicator } from './ConnectionIndicator'

const meta = {
  title: 'Componentes/Indicador de conexión',
  component: ConnectionIndicator,
  parameters: {
    docs: {
      description: {
        component: 'El estado siempre lleva punto y texto: nunca depende solo del color. En línea tiene un pulso suave.',
      },
    },
  },
} satisfies Meta<typeof ConnectionIndicator>

export default meta
type Story = StoryObj<typeof meta>

export const EnLinea: Story = {
  name: 'En línea',
  args: { status: 'online' },
}
export const SinConexion: Story = {
  name: 'Sin conexión',
  args: { status: 'offline' },
}
export const Desconocido: Story = {
  name: 'Desconocido',
  args: { status: 'unknown' },
}

export const Todos: Story = {
  name: 'Todos los estados',
  args: { status: 'online' },
  render: () => (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <ConnectionIndicator status="online" />
      <ConnectionIndicator status="offline" />
      <ConnectionIndicator status="unknown" />
    </div>
  ),
}

const CYCLE: DeviceStatus[] = ['online', 'offline', 'unknown']

function Cycling() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setStep((n) => n + 1), 2_500)
    return () => clearInterval(timer)
  }, [])
  return <ConnectionIndicator status={CYCLE[step % CYCLE.length]} />
}

/** El estado cambia solo cada 2,5 s: el color se transiciona, el texto se funde y se resalta suavemente. */
export const CambioEnVivo: Story = {
  name: 'Cambio de estado en vivo',
  args: { status: 'online' },
  render: () => <Cycling />,
}
