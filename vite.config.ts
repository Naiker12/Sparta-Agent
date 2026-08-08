import { defineConfig, createLogger } from 'vite'
import path from 'node:path'
import { builtinModules } from 'node:module'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(() => {
  // List of Node native built-in modules and heavy native binaries to externalize
  const externalNodeModules = [
    'electron',
    'node-pty',
    '@firecrawl/anydoc',
    /^@firecrawl\//,
    /\.node$/,
    'fsevents',
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
  ]

  const isNativeOrNodeModule = (id: string) => {
    if (id.endsWith('.node') || id.includes('@firecrawl') || id.includes('.node')) return true
    return false
  }

  // Renderer-only packages that must NEVER be bundled into electron-main.js
  const rendererOnlyPackages = [
    'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime',
    'd3', /^d3-/,
    'zustand', 'zustand/middleware',
    'framer-motion',
    'lucide-react',
    'mermaid',
    'monaco-editor', '@monaco-editor/react',
    '@fontsource-variable/geist', '@fontsource/inter', '@fontsource/space-grotesk',
    'class-variance-authority', 'clsx', 'tailwind-merge',
    'tailwindcss', '@tailwindcss/vite', 'tw-animate-css',
    'next-themes', 'sonner',
    'react-markdown', 'remark-gfm',
    'react-syntax-highlighter',
    'react-use-measure', 'react-virtuoso',
    '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities',
    '@floating-ui/dom',
    '@tiptap/react', '@tiptap/starter-kit',
    '@uiw/react-codemirror',
    '@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-search',
    '@xterm/addon-serialize', '@xterm/addon-unicode11',
    '@xterm/addon-web-links', '@xterm/addon-webgl',
    '@tanstack/react-query',
    '@base-ui/react',
    '@pierre/diffs', '@pierre/trees',
    'thinking-orbs', 'shadcn',
  ]

  return {
    resolve: {
      alias: {
        '@': path.join(__dirname, '.'),
        '@/components': path.join(__dirname, 'components'),
        'ia-sparta-app-shell': path.join(__dirname, 'desktop/ia-sparta-app-shell/src/index.ts'),
        'ia-sparta-ipc-bridge': path.join(__dirname, 'desktop/ia-sparta-ipc-bridge/src/index.ts'),
        'ia-sparta-chat-ipc': path.join(__dirname, 'desktop/ia-sparta-chat-ipc/src/index.ts'),
        'ia-sparta-vault': path.join(__dirname, 'desktop/ia-sparta-vault/src/index.ts'),
        'ia-sparta-stream-events': path.join(__dirname, 'desktop/ia-sparta-stream-events/src/index.ts'),
        'ia-sparta-chat': path.join(__dirname, 'desktop/ia-sparta-chat/src/index.ts'),
        'ia-sparta-agents': path.join(__dirname, 'desktop/ia-sparta-agents/src/index.ts'),
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
        'ia-sparta-tabs': path.join(__dirname, 'desktop/ia-sparta-tabs/src/index.ts'),
      },
    },
    define: {
      __IS_ELECTRON__: 'true',
    },
    plugins: [
      tailwindcss(),
      react(),
      electron({
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
                'ia-sparta-tabs': path.join(__dirname, 'desktop/ia-sparta-tabs/src/index.ts'),
              },
            },
            build: {
              target: 'node20',
              sourcemap: false,
              minify: 'esbuild',
              rollupOptions: {
                external: (id) => isNativeOrNodeModule(id) || [...externalNodeModules, ...rendererOnlyPackages].some(e => typeof e === 'string' ? e === id : e instanceof RegExp ? e.test(id) : false),
                onwarn(warning, warn) {
                  if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
                  if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
                  if (warning.message?.includes("Can't resolve original location of error")) return
                  warn(warning)
                },
              },
            },
          },
        },
        preload: {
          input: path.join(__dirname, 'desktop/ia-sparta-ipc-bridge/src/preload.ts'),
          vite: {
            build: {
              target: 'node20',
              sourcemap: false,
              minify: 'esbuild',
              rollupOptions: {
                external: (id) => isNativeOrNodeModule(id) || externalNodeModules.some(e => typeof e === 'string' ? e === id : e instanceof RegExp ? e.test(id) : false),
                onwarn(warning, warn) {
                  if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
                  if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
                  if (warning.message?.includes("Can't resolve original location of error")) return
                  warn(warning)
                },
              },
            },
          },
        },
        renderer: process.env.NODE_ENV === 'test'
          ? undefined
          : {},
      }),
    ],
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('monaco-editor') || id.includes('@monaco-editor') || id.includes('@uiw/react-codemirror')) {
                return 'vendor-editor'
              }
              if (id.includes('mermaid') || id.includes('d3') || id.includes('thinking-orbs')) {
                return 'vendor-charts'
              }
              if (id.includes('xlsx') || id.includes('mammoth')) {
                return 'vendor-documents'
              }
              if (id.includes('@xterm')) {
                return 'vendor-xterm'
              }
              if (id.includes('@tiptap')) {
                return 'vendor-tiptap'
              }
              if (id.includes('framer-motion') || id.includes('lucide-react')) {
                return 'vendor-ui-core'
              }
            }
          },
        },
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
          if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
          if (warning.message?.includes("Can't resolve original location of error")) return
          warn(warning)
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    css: {
      devSourcemap: false,
    },
    customLogger: (() => {
      const logger = createLogger()
      const originalWarn = logger.warn.bind(logger)
      const originalError = logger.error.bind(logger)
      logger.warn = (msg, options) => {
        if (msg.includes("Can't resolve original location of error")) return
        if (msg.includes("sourcemap")) return
        originalWarn(msg, options)
      }
      logger.error = (msg, options) => {
        if (msg.includes("Can't resolve original location of error")) return
        if (msg.includes("sourcemap")) return
        originalError(msg, options)
      }
      return logger
    })(),
  }
})
