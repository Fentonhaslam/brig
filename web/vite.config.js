import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
    port: 5173,
  },
  // top-level await in the entry module (login gate) needs a modern target;
  // supported by all current browsers.
  build: {
    target: 'esnext',
  },
});
