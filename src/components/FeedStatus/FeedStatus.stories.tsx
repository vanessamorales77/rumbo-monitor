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

/** On a phone the status sits in a strip ABOVE the map, so nothing covers the small map. */
const mobileStory = (args: Story['args'], note: string): Story => ({
  args,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  parameters: { layout: 'fullscreen', docs: { description: { story: note } } },
  decorators: [
    () => (
      <div style={{ width: '100%', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <FeedStatus {...(meta.args as Required<NonNullable<Story['args']>>)} {...args} />
        <div
          style={{
            height: '10rem',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 16,
            border: '1px dashed var(--color-border-strong)',
            color: 'var(--color-text-muted)',
          }}
        >
          Mapa
        </div>
      </div>
    ),
  ],
})

const MOBILE_NOTE =
  'En móvil (< 768 px) el estado y su botón pasan a una franja encima del mapa, en el flujo de la página. El botón es un enlace subrayado de 32 px que baja de línea si el texto es largo.'

export const MovilSinDatosNuevos: Story = {
  name: 'Móvil: sin datos nuevos',
  ...mobileStory({ mode: 'live', lastFix: ago(6 * 3600) }, MOBILE_NOTE),
}
export const MovilDemostracion: Story = {
  name: 'Móvil: modo demostración',
  ...mobileStory({ demo: true }, MOBILE_NOTE),
}
export const MovilEnVivo: Story = {
  name: 'Móvil: en vivo',
  ...mobileStory({ mode: 'live' }, MOBILE_NOTE),
}
