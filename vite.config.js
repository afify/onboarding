import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        admin: resolve(__dirname, 'admin.html'),
        trainees: resolve(__dirname, 'trainees.html'),
        tracking: resolve(__dirname, 'tracking.html'),
        tasks: resolve(__dirname, 'tasks.html'),
        program: resolve(__dirname, 'program.html'),
      },
    },
  },
})
