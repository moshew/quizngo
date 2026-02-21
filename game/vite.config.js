import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/game/',
  server: {
    port: 3003,
    host: '127.0.0.1',
    strictPort: true,
    allowedHosts: ['quizngo.online', 'game.quizngo.online'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
