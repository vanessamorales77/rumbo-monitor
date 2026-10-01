import type { Meta, StoryObj } from '@storybook/react-vite'
import { CardSkeleton, FeedSkeleton, MapSkeleton } from './Skeleton'

const meta = {
  title: 'Componentes/Carga (skeleton)',
  parameters: {
    docs: {
      description: {
        component:
          'Usan las mismas clases y alturas que la tarjeta real, así que al llegar los datos no hay saltos de diseño (CLS).',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Tarjeta: Story = {
  name: 'Tarjeta',
  render: () => (
    <div style={{ width: '22.5rem' }}>
      <CardSkeleton />
    </div>
  ),
}

export const Mapa: Story = {
  name: 'Mapa',
  render: () => (
    <div style={{ position: 'relative', width: '32rem', height: '20rem' }}>
      <MapSkeleton />
    </div>
  ),
}

export const FranjaDeEstado: Story = {
  name: 'Franja de estado (móvil)',
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Solo se ve en móvil: reserva el hueco de una línea que ocupa el estado del flujo encima del mapa, para que no empuje el contenido al cargar. En tablet y escritorio ese estado flota sobre el mapa y no se reserva nada.',
      },
    },
  },
  render: () => (
    <div style={{ width: '100%', boxSizing: 'border-box', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <FeedSkeleton />
      <div style={{ position: 'relative', height: '12rem' }}>
        <MapSkeleton />
      </div>
    </div>
  ),
}
