import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 🌐 להגדרת IP של השרת Python (במקום localhost):
// שנה את SERVER_IP ל-IP המקומי של המחשב שרץ עליו השרת Python
// דוגמה: const SERVER_IP = '192.168.1.100'
const SERVER_IP = 'localhost'  // שנה את זה ל-IP של השרת!

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // מאפשר גישה מכל מחשב ברשת
    port: 3002,
    proxy: {
      '/api': {
        target: `http://${SERVER_IP}:5000`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})

