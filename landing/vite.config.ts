import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fumadocsMdx from 'fumadocs-mdx/vite';
import path from 'path';
import { generateDocsCatalog } from './scripts/docs-catalog.mjs';

export default defineConfig({
  base: './',
  plugins: [{ name: 'sparta-docs-catalog', buildStart() { generateDocsCatalog(); }, handleHotUpdate(context) { if (context.file.endsWith('.mdx')) generateDocsCatalog(); } }, fumadocsMdx({}), react(), tailwindcss()],
  build: { manifest: true },
  optimizeDeps: {
    include: ['cookie', 'set-cookie-parser', 'react-router', 'react-router-dom'],
  },
  ssr: { noExternal: ['fumadocs-core', 'fumadocs-ui'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
  },
});
