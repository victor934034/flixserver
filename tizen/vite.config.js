import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'chrome76', // Samsung Tizen 5.0+ usa Chrome 76
    minify: 'esbuild',
  },
  server: {
    port: 5173,
    host: true,
  },
});
