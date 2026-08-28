import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fumadocsMdx from 'fumadocs-mdx/vite';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [fumadocsMdx({}), react(), tailwindcss()],
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
