import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const lbTarget = (env.VITE_LB_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '')

  return {
    plugins: [react()],
    server: {
      port: 3001,
      host: '127.0.0.1',
      strictPort: true,
      allowedHosts: ['quizngo.online', 'sim.quizngo.online'],
      proxy: {
        '/api': {
          target: lbTarget,
          changeOrigin: true
        }
      }
    }
  }
})






