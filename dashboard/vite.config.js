import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/dashboard/',
  server: {
    host: '127.0.0.1',
    port: 5010,
    strictPort: true,
    allowedHosts: ['quizngo.online', 'dashboard.quizngo.online'],
  },
  preview: {
    host: '127.0.0.1',
    port: 5010,
    strictPort: true,
  },
})
