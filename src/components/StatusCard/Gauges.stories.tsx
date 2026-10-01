import type { Meta, StoryObj } from '@storybook/react-vite'
import { BatteryBar } from './BatteryBar'
import { SpeedGauge } from './SpeedGauge'
import { SpeedReadout } from './SpeedReadout'
import './StatusCard.css'

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
      <SpeedReadout speed={kmh} shown={kmh} lastSpeed={kmh} noDataLabel="" />
    </SpeedGauge>
  </div>
)

/** Without a current speed the arc is empty and the centre says why; the last known speed is history. */
const noSpeed = (noDataLabel: string, lastSpeed: number | null) => (
  <div style={{ width: '16rem', height: '9.25rem' }}>
    <SpeedGauge value={0}>
      <SpeedReadout speed={null} shown={null} lastSpeed={lastSpeed} noDataLabel={noDataLabel} />
    </SpeedGauge>
  </div>
)

export const ArcoDetenido: Story = {
  name: 'Arco: detenido (0, "Detenido")',
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

export const ArcoSinSenal: Story = {
  name: 'Arco: sin señal (vehículo offline)',
  render: () => noSpeed('Sin señal', 38),
}
export const ArcoSinDatosNuevos: Story = {
  name: 'Arco: sin datos nuevos',
  render: () => noSpeed('Sin datos nuevos', 38),
}
export const ArcoSinDatos: Story = {
  name: 'Arco: sin ningún dato',
  render: () => noSpeed('Sin datos', null),
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
