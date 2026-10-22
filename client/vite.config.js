import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // @game/shared lives outside the client root (npm workspace).
    fs: { allow: ['..'] },
  },
  build: {
    target: 'es2022',
    // The three/R3F vendor chunk is ~800 kB minified; everything else is split.
    chunkSizeWarningLimit: 900,
    reportCompressedSize: true,
  },
})
