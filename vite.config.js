import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // In development the game server (`npm run server`) runs next to Vite on port 8787.
  server: { proxy: { '/ws': { target: 'ws://localhost:8787', ws: true } } },
})
