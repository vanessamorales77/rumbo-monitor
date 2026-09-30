import type { Preview } from '@storybook/react-vite'
import '../src/styles/tokens.css'
import '../src/styles/themes.css'
import '../src/styles/base.css'

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Tema de color',
      toolbar: {
        title: 'Tema',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Claro', icon: 'sun' },
          { value: 'dark', title: 'Oscuro', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, context) => {
      // Same mechanism as the app: data-theme on <html> drives every colour token.
      const theme = context.globals.theme === 'dark' ? 'dark' : 'light'
      document.documentElement.dataset.theme = theme
      document.body.style.background = 'var(--color-bg)'
      document.body.style.color = 'var(--color-text)'
      return <Story />
    },
  ],
  parameters: {
    layout: 'centered',
    backgrounds: { disabled: true },
    a11y: { test: 'todo' },
  },
}

export default preview
