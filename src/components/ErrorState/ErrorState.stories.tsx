import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ErrorState } from './ErrorState'

const meta = {
  title: 'Componentes/Estado de error',
  component: ErrorState,
  args: { onRetry: fn(), onDemo: fn() },
  parameters: {
    docs: {
      description: {
        component:
          'Mensaje empático con botón de reintento. Al aparecer, el foco pasa al título y el contenedor usa `role="alert"`.',
      },
    },
  },
} satisfies Meta<typeof ErrorState>

export default meta
type Story = StoryObj<typeof meta>

export const SinRed: Story = {
  name: 'Sin red',
  args: { kind: 'network' },
}
export const TiempoAgotado: Story = {
  name: 'Tiempo agotado',
  args: { kind: 'timeout' },
}
export const Credenciales: Story = {
  name: 'Credenciales rechazadas',
  args: { kind: 'auth' },
}
export const ErrorDelServidor: Story = {
  name: 'Error del servidor',
  args: { kind: 'server' },
}
