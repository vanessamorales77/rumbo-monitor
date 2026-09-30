import type { Meta, StoryObj } from '@storybook/react-vite'
import { CardSkeleton, MapSkeleton } from './Skeleton'

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
