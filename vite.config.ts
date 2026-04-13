import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/WebGreenLoop/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
