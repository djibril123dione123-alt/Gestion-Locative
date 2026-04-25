import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La config `server.*` ci-dessous ne s'applique qu'au dev server (npm run dev)
// et est nécessaire pour que la preview Replit puisse proxifier l'app.
// En production (npm run build), seul le contenu de `dist/` est servi en static.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
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
