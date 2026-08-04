import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const bundlePath = join(process.cwd(), 'dist-electron', 'electron-main.js')

if (!existsSync(bundlePath)) {
  console.warn('⚠️ Warning: dist-electron/electron-main.js no existe todavía. Saltando chequeo.')
  process.exit(0)
}

const banned = ['react', 'react-dom', 'framer-motion', 'lucide-react', 'mermaid', 'monaco-editor']
const code = readFileSync(bundlePath, 'utf8')

const leaks = banned.filter((pkg) =>
  new RegExp(`from ['"]${pkg}(/|['"])`).test(code) ||
  new RegExp(`require\\(['"]${pkg}(/|['"])`).test(code)
)

if (leaks.length > 0) {
  console.error(`❌ ERROR DE ARQUITECTURA: Paquetes de UI/Renderer colados en electron-main.js: ${leaks.join(', ')}`)
  console.error('Revise las reglas de importación en docs/25-reglas-de-imports.md')
  process.exit(1)
}

console.log('✓ electron-main.js limpio de dependencias de renderer/UI.')
