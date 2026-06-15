import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
    port: 5173,
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 3500,
    rollupOptions: {
      // The lightweight three.js build is now the default. index.html and
      // game.html both serve it (game.html kept as the existing public URL).
      // The old Babylon entry (bjs.html) is retired — no longer built, so its
      // ~6.5 MB of engine is dropped from the bundle.
      input: { main: 'index.html', game: 'game.html' },
      output: {
        manualChunks: {
          three: ['three'],
          rapier: ['@dimforge/rapier3d-compat'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
