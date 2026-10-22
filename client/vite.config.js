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
    chunkSizeWarningLimit: 800,
    reportCompressedSize: true,
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks: a game update doesn't re-download three.js.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 30 },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            { name: 'r3f', test: /node_modules[\\/](@react-three|three-stdlib|zustand|its-fine|suspend-react|use-sync-external-store|@monogrid|maath|three-mesh-bvh)/, priority: 10 },
            { name: 'net', test: /node_modules[\\/](@colyseus|msgpackr)/, priority: 10 },
          ],
        },
      },
    },
  },
})
