import type { Meta, StoryObj } from '@storybook/react-vite'
import { FeedStatus } from './FeedStatus'

const meta = {
  title: 'Componentes/Estado del flujo',
  component: FeedStatus,
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 360, height: 72 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Indica cómo llegan los datos: WebSocket (en vivo), polling cada 5 s, o sin conexión cuando el polling falla varias veces seguidas y lo mostrado puede estar desactualizado.',
      },
    },
  },
} satisfies Meta<typeof FeedStatus>

export default meta
type Story = StoryObj<typeof meta>

export const EnVivo: Story = { name: 'En vivo', args: { mode: 'live' } }
export const Polling: Story = { name: 'Polling', args: { mode: 'polling' } }
export const Perdido: Story = { name: 'Sin conexión', args: { mode: 'lost' } }
