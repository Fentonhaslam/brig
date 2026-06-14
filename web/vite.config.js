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
      // two entries: the live Three.js build (index.html) + the Babylon build
      input: { main: 'index.html', bjs: 'bjs.html' },
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
