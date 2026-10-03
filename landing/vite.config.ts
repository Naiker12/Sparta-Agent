import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fumadocsMdx from 'fumadocs-mdx/vite';
import path from 'path';
import { createRequire } from 'node:module';
const demoRequire = createRequire(import.meta.url);
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
    dedupe: ["react", "react-dom", "streamdown", "remend", "mdast-util-from-markdown", "mdast-util-gfm", "mdast-util-math", "micromark-extension-gfm", "micromark-extension-math"],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@blobatar/react': demoRequire.resolve('@blobatar/react'),
      'blobatar/expression': demoRequire.resolve('blobatar/expression'),
      '@radix-ui/react-slot': path.resolve(__dirname,'node_modules/@radix-ui/react-slot/dist/index.mjs'),
      'class-variance-authority': demoRequire.resolve('class-variance-authority'),
    },
  },
  server: {
    port: 5174,
  },
});
