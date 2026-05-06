import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // FastAPI 新模块 — 需单独启动 (port 8000)
      '/api/v2': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Flask 存量 API
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      // Socket.IO 握手（HTTP）+ WebSocket 升级透传
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
