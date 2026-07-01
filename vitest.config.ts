import { configDefaults, defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: [...configDefaults.exclude, 'python/.pytest_cache/**', 'python/.venv/**'],
  },
})
