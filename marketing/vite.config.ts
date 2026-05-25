import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  publicDir: resolve(root, '../public'),
  build: {
    outDir: resolve(root, '../dist-marketing'),
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5176,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5176,
    allowedHosts: true,
  },
});
