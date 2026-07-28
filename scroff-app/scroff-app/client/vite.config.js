import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the browser only ever talks to the Vite server (5173). Vite
// transparently forwards /api and /uploads to the real backend (4000), so
// the browser sees everything as same-origin and session/admin cookies
// "just work" without any CORS configuration. In production there's no
// proxy at all — the backend serves the built client directly (see
// server/src/app.js) so there is only one origin to begin with.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
