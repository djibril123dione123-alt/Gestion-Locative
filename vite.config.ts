import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// La config `server.*` ci-dessous ne s'applique qu'au dev server (npm run dev)
// et est nécessaire pour que la preview Replit puisse proxifier l'app.
// En production (npm run build), seul le contenu de `dist/` est servi en static.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true, // Required for Sentry release tracking
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: 'all',
  },
  preview: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: 'all',
  },
});
