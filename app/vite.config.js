import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/app/',
  server: {
    host: '127.0.0.1',
    port: 3004,
    strictPort: true,
    allowedHosts: ['quizngo.online', 'app.quizngo.online'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5020',
        changeOrigin: true
      }
    }
  }
})
