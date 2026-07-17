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
        'ia-sparta-app-shell': path.join(__dirname, 'desktop/ia-sparta-app-shell/src/index.ts'),
        'ia-sparta-ipc-bridge': path.join(__dirname, 'desktop/ia-sparta-ipc-bridge/src/index.ts'),
        'ia-sparta-chat-ipc': path.join(__dirname, 'desktop/ia-sparta-chat-ipc/src/index.ts'),
        'ia-sparta-vault': path.join(__dirname, 'desktop/ia-sparta-vault/src/index.ts'),
        'ia-sparta-stream-events': path.join(__dirname, 'desktop/ia-sparta-stream-events/src/index.ts'),
        'ia-sparta-chat': path.join(__dirname, 'desktop/ia-sparta-chat/src/index.ts'),
        'ia-sparta-agents': path.join(__dirname, 'desktop/ia-sparta-agents/src/index.ts'),
        'ia-sparta-editor': path.join(__dirname, 'desktop/ia-sparta-editor/src/index.ts'),
        'ia-sparta-terminal': path.join(__dirname, 'desktop/ia-sparta-terminal/src/index.ts'),
        'ia-sparta-mcp': path.join(__dirname, 'desktop/ia-sparta-mcp/src/index.ts'),
        'ia-sparta-memory': path.join(__dirname, 'desktop/ia-sparta-memory/src/index.ts'),
        'ia-sparta-permission': path.join(__dirname, 'desktop/ia-sparta-permission/src/index.ts'),
        'ia-sparta-providers': path.join(__dirname, 'desktop/ia-sparta-providers/src/index.ts'),
        'ia-sparta-settings': path.join(__dirname, 'desktop/ia-sparta-settings/src/index.ts'),
        'ia-sparta-skills': path.join(__dirname, 'desktop/ia-sparta-skills/src/index.ts'),
        'ia-sparta-channels': path.join(__dirname, 'desktop/ia-sparta-channels/src/index.ts'),
        'ia-sparta-projects': path.join(__dirname, 'desktop/ia-sparta-projects/src/index.ts'),
        'ia-sparta-shell-layout': path.join(__dirname, 'desktop/ia-sparta-shell-layout/src/index.ts'),
        'ia-sparta-design-system': path.join(__dirname, 'desktop/ia-sparta-design-system/src/index.ts'),
        'ia-sparta-i18n': path.join(__dirname, 'desktop/ia-sparta-i18n/src/index.ts'),
        'ia-sparta-core': path.join(__dirname, 'desktop/ia-sparta-core/src/index.ts'),
        'ia-sparta-platform': path.join(__dirname, 'desktop/ia-sparta-platform/src/index.ts'),
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
              entry: path.join(__dirname, 'desktop/ia-sparta-app-shell/src/electron-main.ts'),
              vite: {
                resolve: {
                  alias: {
                    'ia-sparta-ipc-bridge': path.join(__dirname, 'desktop/ia-sparta-ipc-bridge/src/index.ts'),
                    'ia-sparta-chat-ipc': path.join(__dirname, 'desktop/ia-sparta-chat-ipc/src/index.ts'),
                    'ia-sparta-vault': path.join(__dirname, 'desktop/ia-sparta-vault/src/index.ts'),
                    'ia-sparta-stream-events': path.join(__dirname, 'desktop/ia-sparta-stream-events/src/index.ts'),
                    'ia-sparta-chat': path.join(__dirname, 'desktop/ia-sparta-chat/src/index.ts'),
                    'ia-sparta-agents': path.join(__dirname, 'desktop/ia-sparta-agents/src/index.ts'),
                    'ia-sparta-editor': path.join(__dirname, 'desktop/ia-sparta-editor/src/index.ts'),
                    'ia-sparta-terminal': path.join(__dirname, 'desktop/ia-sparta-terminal/src/index.ts'),
                    'ia-sparta-mcp': path.join(__dirname, 'desktop/ia-sparta-mcp/src/index.ts'),
                    'ia-sparta-memory': path.join(__dirname, 'desktop/ia-sparta-memory/src/index.ts'),
                    'ia-sparta-permission': path.join(__dirname, 'desktop/ia-sparta-permission/src/index.ts'),
                    'ia-sparta-providers': path.join(__dirname, 'desktop/ia-sparta-providers/src/index.ts'),
                    'ia-sparta-settings': path.join(__dirname, 'desktop/ia-sparta-settings/src/index.ts'),
                    'ia-sparta-skills': path.join(__dirname, 'desktop/ia-sparta-skills/src/index.ts'),
                    'ia-sparta-channels': path.join(__dirname, 'desktop/ia-sparta-channels/src/index.ts'),
                    'ia-sparta-projects': path.join(__dirname, 'desktop/ia-sparta-projects/src/index.ts'),
                    'ia-sparta-shell-layout': path.join(__dirname, 'desktop/ia-sparta-shell-layout/src/index.ts'),
                    'ia-sparta-design-system': path.join(__dirname, 'desktop/ia-sparta-design-system/src/index.ts'),
                    'ia-sparta-i18n': path.join(__dirname, 'desktop/ia-sparta-i18n/src/index.ts'),
                    'ia-sparta-core': path.join(__dirname, 'desktop/ia-sparta-core/src/index.ts'),
                    'ia-sparta-platform': path.join(__dirname, 'desktop/ia-sparta-platform/src/index.ts'),
                    'ia-sparta-app-shell': path.join(__dirname, 'desktop/ia-sparta-app-shell/src/index.ts'),
                  },
                },
                build: {
                  rollupOptions: {
                    external: ['electron', 'node-pty'],
                  },
                },
              },
            },
            preload: {
              input: path.join(__dirname, 'desktop/ia-sparta-ipc-bridge/src/preload.ts'),
              vite: {
                build: {
                  rollupOptions: {
                    external: ['electron', 'node-pty'],
                  },
                },
              },
            },
            renderer: process.env.NODE_ENV === 'test'
              ? undefined
              : {},
          })]
        : []),
    ],
    build: {
      outDir: isElectron ? 'dist' : 'dist-web',
    },
    server: {
      port: 5173,
      proxy: isElectron ? undefined : {
        '/api': {
          target: 'http://localhost:8765',
          changeOrigin: true,
        },
      },
    },
  }
})
