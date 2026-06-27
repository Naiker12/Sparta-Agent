import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Default: Electron. Web mode via --mode web (pnpm dev:web)
  const isElectron = mode !== 'web'

  return {
    resolve: {
      alias: {
        '@': path.join(__dirname, 'src'),
      },
    },
    define: {
      __IS_ELECTRON__: JSON.stringify(isElectron),
    },
    plugins: [
      tailwindcss(),
      react(),
      ...(isElectron
        ? [electron({
            main: {
              entry: 'electron/main.ts',
            },
            preload: {
              input: path.join(__dirname, 'electron/preload.ts'),
            },
            renderer: process.env.NODE_ENV === 'test'
              ? undefined
              : {},
          })]
        : []),
    ],
    build: {
      outDir: isElectron ? 'dist' : 'dist-web',
      rollupOptions: isElectron ? {
        external: ['electron'],
      } : {},
    },
    server: {
      port: 5173,
      proxy: isElectron ? {} : {
        '/api': {
          target: 'http://localhost:8765',
          changeOrigin: true,
        },
      },
    },
  }
})
