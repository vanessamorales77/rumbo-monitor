import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// In dev, /api is proxied to Traccar so the browser never makes a cross-origin call
// (the demo servers send no Access-Control-Allow-Origin header).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.TRACCAR_TARGET || 'https://demo4.traccar.org'
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          ws: true,
          cookieDomainRewrite: '',
          headers: { origin: target },
        },
      },
    },
  }
})
