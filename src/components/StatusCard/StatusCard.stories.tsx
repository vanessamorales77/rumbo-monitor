import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { makeDevice, makePosition } from '../fixtures'
import { ThemePair } from '../ThemePair'
import { StatusCard } from './StatusCard'

const meta = {
  title: 'Componentes/Tarjeta de estado',
  component: StatusCard,
  decorators: [
    // The side-by-side story lays itself out (parameters.fullWidth), so it skips this fixed frame.
    (Story, { parameters }) =>
      parameters.fullWidth ? (
        <Story />
      ) : (
        <div style={{ width: '22.5rem' }}>
          <Story />
        </div>
      ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Nombre, conexión, velocidad, batería y última actualización de un vehículo. Usa `<dl>` semántico y una región `aria-live` oculta que solo anuncia cambios relevantes.',
      },
    },
  },
} satisfies Meta<typeof StatusCard>

export default meta
type Story = StoryObj<typeof meta>

export const EnLinea: Story = {
  name: 'En línea',
  args: { device: makeDevice(), position: makePosition({ speedKmh: 34, battery: 79 }) },
}

export const SinPlaca: Story = {
  name: 'Nombre sin placa',
  args: { device: makeDevice({ name: 'Camioneta de reparto' }), position: makePosition({ speedKmh: 34, battery: 79 }) },
}

export const Detenido: Story = {
  name: 'Detenido',
  args: { device: makeDevice(), position: makePosition({ speedKmh: 0, battery: 64 }) },
}

export const VelocidadAlta: Story = {
  name: 'Velocidad alta',
  args: { device: makeDevice(), position: makePosition({ speedKmh: 112, battery: 91 }) },
}

export const SinConexion: Story = {
  name: 'Sin conexión',
  args: { device: makeDevice({ status: 'offline' }), position: makePosition({ speedKmh: 34, ageSeconds: 5 * 60 }) },
}

export const SinDatosNuevos: Story = {
  name: 'Sin datos nuevos',
  args: { device: makeDevice(), position: makePosition({ speedKmh: 34, ageSeconds: 10 * 60 }) },
}

export const Desconocido: Story = {
  name: 'Desconocido',
  args: { device: makeDevice({ status: 'unknown' }), position: makePosition({ speedKmh: 0, ageSeconds: 2 * 3600 }) },
}

export const BateriaBaja: Story = {
  name: 'Batería baja',
  args: { device: makeDevice(), position: makePosition({ speedKmh: 28, battery: 12 }) },
}

export const SinDatoDeBateria: Story = {
  name: 'Sin dato de batería',
  args: { device: makeDevice(), position: makePosition({ speedKmh: 40, battery: null }) },
}

export const SinPosicion: Story = {
  name: 'Sin posición',
  args: { device: makeDevice({ status: 'unknown', name: 'Renault Master · GHI-789' }), position: null },
}

function LiveCard({ device }: { device: ReturnType<typeof makeDevice> }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 2_000)
    return () => clearInterval(timer)
  }, [])
  const speedKmh = Math.round(45 + Math.sin(tick * 0.9) * 40)
  const battery = Math.max(5, 90 - tick * 3)
  return <StatusCard device={device} position={makePosition({ speedKmh, battery, ageSeconds: 0 })} />
}

/** Los valores cambian solos cada 2 s para revisar las transiciones (números, resaltado y fundido). */
export const CambiosEnVivo: Story = {
  name: 'Cambios en vivo',
  args: { device: makeDevice(), position: makePosition() },
  render: (args) => <LiveCard device={args.device} />,
}

const sideBySide: Array<{ label: string; device: ReturnType<typeof makeDevice>; position: ReturnType<typeof makePosition> }> = [
  { label: 'En línea', device: makeDevice(), position: makePosition({ speedKmh: 34, battery: 79 }) },
  { label: 'Detenido', device: makeDevice(), position: makePosition({ speedKmh: 0, battery: 64 }) },
  { label: 'Sin señal (offline)', device: makeDevice({ status: 'offline' }), position: makePosition({ speedKmh: 34, ageSeconds: 5 * 60 }) },
  { label: 'Sin datos nuevos', device: makeDevice(), position: makePosition({ speedKmh: 34, ageSeconds: 10 * 60 }) },
  { label: 'Batería baja', device: makeDevice(), position: makePosition({ speedKmh: 28, battery: 12 }) },
]

/** Revisión de contraste: en estos estados el color lleva significado (verde, ámbar, rojo), por eso se ven los dos temas a la vez. */
export const ClaroYOscuro: Story = {
  name: 'Claro y oscuro: estados clave',
  args: { device: makeDevice(), position: makePosition() },
  parameters: { layout: 'padded', fullWidth: true },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {sideBySide.map(({ label, device, position }) => (
        <ThemePair key={label} label={label}>
          <div style={{ width: '22.5rem' }}>
            <StatusCard device={device} position={position} />
          </div>
        </ThemePair>
      ))}
    </div>
  ),
}
