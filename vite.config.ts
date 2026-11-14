import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve('app/web'),
  plugins: [react()],
  publicDir: false,
  cacheDir: resolve('.cache/vite'),
  envDir: resolve('.runtime/frontend-env'),
  build: { outDir: resolve('dist'), emptyOutDir: true },
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    fs: { allow: [resolve('app/web'), resolve('node_modules'), resolve('artifacts/logos')] },
    proxy: { '/api': 'http://127.0.0.1:4317', '/rune': 'http://127.0.0.1:4317', '/logos': 'http://127.0.0.1:4317' }
  }
});
