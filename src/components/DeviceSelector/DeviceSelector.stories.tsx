import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { sampleDevices } from '../fixtures'
import { DeviceSelector } from './DeviceSelector'

const meta = {
  title: 'Componentes/Selector de vehículo',
  component: DeviceSelector,
  args: { devices: sampleDevices, selectedId: 1, onSelect: () => undefined },
  parameters: {
    docs: {
      description: { component: '`<select>` nativo con etiqueta accesible (oculta visualmente): teclado y lectores de pantalla sin trabajo extra.' },
    },
  },
} satisfies Meta<typeof DeviceSelector>

export default meta
type Story = StoryObj<typeof meta>

function InteractiveSelector(props: Parameters<typeof DeviceSelector>[0]) {
  const [selected, setSelected] = useState<number | null>(props.selectedId)
  return <DeviceSelector {...props} selectedId={selected} onSelect={setSelected} />
}

export const Interactivo: Story = {
  name: 'Interactivo',
  render: (args) => <InteractiveSelector {...args} />,
}

export const Deshabilitado: Story = {
  name: 'Deshabilitado',
  args: { disabled: true },
}
export const SinVehiculos: Story = {
  name: 'Sin vehículos',
  args: { devices: [], selectedId: null },
}
