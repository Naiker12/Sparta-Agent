import { defineConfig, createLogger } from 'vite'
import path from 'node:path'
import { builtinModules } from 'node:module'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Codex and some Node toolchains set this flag for Electron's Node runtime.
// It must never reach the child process spawned by vite-plugin-electron, or
// Electron starts as plain Node and cannot load BrowserWindow/shell.
delete process.env.ELECTRON_RUN_AS_NODE

export default defineConfig(() => {
  // List of Node native built-in modules and heavy native binaries to externalize
  const externalNodeModules = [
    'electron',
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
    '@fontsource-variable/geist', '@fontsource-variable/inter', '@fontsource-variable/space-grotesk',
    'class-variance-authority', 'clsx', 'tailwind-merge',
    'tailwindcss', '@tailwindcss/vite', 'tw-animate-css',
    'next-themes', 'sonner',
    'streamdown', '@streamdown/code', '@streamdown/math', '@streamdown/mermaid', 'katex',
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
    '@tanstack/react-table',
    '@hugeicons/react',
    '@base-ui/react',
    '@pierre/diffs', '@pierre/trees',
    'thinking-orbs', 'shadcn',
  ]

  return {
    resolve: {
      alias: {
        '@': path.join(__dirname, 'desktop/frontend-spartan/src'),
        '@/components': path.join(__dirname, 'desktop/frontend-spartan/src/components'),
        'ia-sparta-app-shell': path.join(__dirname, 'desktop/ia-sparta-app-shell/src/index.ts'),
        'ia-sparta-ipc-bridge': path.join(__dirname, 'desktop/ia-sparta-ipc-bridge/src/index.ts'),
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
                'ia-sparta-app-shell': path.join(__dirname, 'desktop/ia-sparta-app-shell/src/index.ts'),
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
          input: path.join(__dirname, 'desktop/ia-sparta-ipc-bridge/src/electron-preload.ts'),
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
    optimizeDeps: {
      entries: ['index.html'],
      include: [
        '@tanstack/react-table',
        '@hugeicons/react',
        'react',
        'react-dom',
      ],
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
