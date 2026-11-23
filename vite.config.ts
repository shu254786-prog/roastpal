import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    host: true,
    port: 5188,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3188',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:3188',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
