import type { Meta, StoryObj } from '@storybook/react-vite'
import { NoVehicles } from './NoVehicles'

const meta = {
  title: 'Componentes/Sin vehículos',
  component: NoVehicles,
  decorators: [
    (Story) => (
      <div style={{ width: '22.5rem', maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Se muestra en lugar de la tarjeta cuando el inicio de sesión funciona pero la cuenta no tiene ningún dispositivo.',
      },
    },
  },
} satisfies Meta<typeof NoVehicles>

export default meta
type Story = StoryObj<typeof meta>

export const CuentaSinDispositivos: Story = { name: 'Cuenta sin dispositivos' }
