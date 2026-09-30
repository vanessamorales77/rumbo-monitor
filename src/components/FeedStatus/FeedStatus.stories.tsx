import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { FeedStatus } from './FeedStatus'

const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString()

const meta = {
  title: 'Componentes/Estado del flujo',
  component: FeedStatus,
  args: { mode: 'live', lastFix: ago(4), demo: false, onEnterDemo: fn(), onExitDemo: fn() },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 420, height: 130 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Dice cuánto se puede confiar en lo que se ve: en vivo, por polling, sin datos nuevos (conectado pero la última posición es vieja), sin conexión, o modo demostración con datos simulados. Cuando los datos son viejos o se perdió la conexión ofrece ver el modo demostración; en demostración, volver a los datos reales.',
      },
    },
  },
} satisfies Meta<typeof FeedStatus>

export default meta
type Story = StoryObj<typeof meta>

export const EnVivo: Story = { name: 'En vivo', args: { mode: 'live' } }
export const Polling: Story = { name: 'Polling', args: { mode: 'polling' } }
export const SinDatosNuevos: Story = {
  name: 'Sin datos nuevos',
  args: { mode: 'live', lastFix: ago(6 * 3600) },
}
export const Perdido: Story = { name: 'Sin conexión', args: { mode: 'lost' } }
export const Demostracion: Story = { name: 'Modo demostración', args: { demo: true } }
