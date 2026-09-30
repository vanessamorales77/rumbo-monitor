import type { Meta, StoryObj } from '@storybook/react-vite'
import { BatteryBar } from './BatteryBar'
import { SpeedGauge } from './SpeedGauge'

const meta = {
  title: 'Componentes/Medidores',
  parameters: {
    docs: {
      description: {
        component:
          'Ambos son decorativos (`aria-hidden`): el valor siempre está en el texto que los acompaña.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const gauge = (kmh: number) => (
  <div style={{ width: '16rem', height: '9.25rem' }}>
    <SpeedGauge value={kmh}>
      <span style={{ fontSize: '3.5rem', fontWeight: 600, lineHeight: 1 }}>{kmh}</span>
      <span style={{ marginLeft: 4, color: 'var(--color-text-muted)' }}>km/h</span>
    </SpeedGauge>
  </div>
)

export const ArcoDetenido: Story = {
  name: 'Arco: detenido (0)',
  render: () => gauge(0),
}
export const ArcoUrbano: Story = {
  name: 'Arco: urbano (38)',
  render: () => gauge(38),
}
export const ArcoLimite: Story = {
  name: 'Arco: límite (120)',
  render: () => gauge(120),
}

const bar = (level: number, low = false) => (
  <div style={{ width: '18rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
    <BatteryBar level={level} low={low} />
    <span>{level} %</span>
  </div>
)

export const BateriaLlena: Story = {
  name: 'Batería: llena',
  render: () => bar(100),
}
export const BateriaMedia: Story = {
  name: 'Batería: media',
  render: () => bar(55),
}
export const BateriaBaja: Story = {
  name: 'Batería: baja',
  render: () => bar(15, true),
}
