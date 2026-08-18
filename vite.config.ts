import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    // Put the Sentry vite plugin after all other plugins
    sentryVitePlugin({
      org: process.env.SENTRY_ORG || "samay-keur",
      project: process.env.SENTRY_PROJECT || "samay-keur-app",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: process.env.NODE_ENV !== "production" || !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['jspdf', 'jspdf-autotable'],
  },
  build: {
    outDir: 'dist',
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 1500,
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
});
