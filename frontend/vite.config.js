import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    // Proxy /api/* to the Express backend so no CORS is needed in dev.
    proxy: { '/api': { target: process.env.VITE_API_TARGET || 'http://localhost:4000', rewrite: (p) => p.replace(/^\/api/, '') } },
  },
});
