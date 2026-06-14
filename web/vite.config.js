import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
    port: 5173,
  },
  // Havok ships a .wasm that must be emitted as an asset, not pre-bundled
  optimizeDeps: { exclude: ['@babylonjs/havok'] },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 3500,
    rollupOptions: {
      // index.html = current (Babylon) live build; game.html = the lightweight
      // three.js rebuild in progress. game.html becomes index.html at the flip.
      input: { main: 'index.html', game: 'game.html' },
      output: {
        manualChunks: {
          three: ['three'],
          rapier: ['@dimforge/rapier3d-compat'],
          supabase: ['@supabase/supabase-js'],
          babylon: ['@babylonjs/core'],
          babylongui: ['@babylonjs/gui'],
        },
      },
    },
  },
});
