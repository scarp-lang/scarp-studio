import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Separate entry point, output directory and public asset policy.
// This build is never consumed by the desktop packaging workflow.
export default defineConfig({
  root: 'qa/browser-search',
  publicDir: false,
  plugins: [react()],
  build: {
    target: 'es2022',
    outDir: '../../dist-search-smoke',
    emptyOutDir: true,
  },
});
