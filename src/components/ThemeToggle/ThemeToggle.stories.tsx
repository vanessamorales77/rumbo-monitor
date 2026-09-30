import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Theme } from '../../hooks/useTheme'
import { ThemeToggle } from './ThemeToggle'

const meta = {
  title: 'Componentes/Cambio de tema',
  component: ThemeToggle,
  args: { theme: 'light', onToggle: () => undefined },
  parameters: {
    docs: { description: { component: 'Botón `role="switch"` con `aria-checked`. Operable con Tab, Espacio y Enter.' } },
  },
} satisfies Meta<typeof ThemeToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Claro: Story = {
  name: 'Claro',
  args: { theme: 'light' },
}
export const Oscuro: Story = {
  name: 'Oscuro',
  args: { theme: 'dark' },
}

function InteractiveToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  return <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} />
}

/** Solo cambia el icono de esta historia; el tema de la página se controla desde la barra de Storybook. */
export const Interactivo: Story = {
  name: 'Interactivo',
  render: () => <InteractiveToggle />,
}
