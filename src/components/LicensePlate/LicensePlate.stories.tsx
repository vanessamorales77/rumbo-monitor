import type { Meta, StoryObj } from '@storybook/react-vite'
import { LicensePlate } from './LicensePlate'

const meta = {
  title: 'Componentes/Placa',
  component: LicensePlate,
  args: { value: 'ABC-123' },
  parameters: {
    docs: {
      description: {
        component:
          'La placa del vehículo con el aspecto de una placa real (fondo amarillo, caracteres oscuros). Es igual en claro y oscuro porque imita un objeto físico. Los lectores de pantalla leen "Placa ABC-123".',
      },
    },
  },
} satisfies Meta<typeof LicensePlate>

export default meta
type Story = StoryObj<typeof meta>

export const Auto: Story = { name: 'Automóvil' }
export const Moto: Story = { name: 'Moto', args: { value: 'PQR-98A' } }
