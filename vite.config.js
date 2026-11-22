import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5420,
    strictPort: true,
    host: true
  }
});
