import type { Meta, StoryObj } from '@storybook/react-vite'
import { FleetSummary } from './FleetSummary'

const meta = {
  title: 'Componentes/Resumen de flota',
  component: FleetSummary,
  args: { online: 2, total: 3 },
  parameters: {
    docs: {
      description: {
        component:
          'Cuántos vehículos están en línea, sin importar cuál esté seleccionado. En escritorio y tablet va en la cabecera; en móvil, en la franja de estado sobre el mapa. Punto más texto: nunca solo color.',
      },
    },
  },
} satisfies Meta<typeof FleetSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Parcial: Story = { name: 'Algunos en línea' }
export const Todos: Story = { name: 'Todos en línea', args: { online: 3, total: 3 } }
export const Ninguno: Story = { name: 'Ninguno en línea', args: { online: 0, total: 3 } }
