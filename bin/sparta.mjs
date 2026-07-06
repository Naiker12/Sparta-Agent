#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { platform } from 'node:os'

const ROOT = resolve(import.meta.dirname, '..')

const isWin = platform() === 'win32'
const venvBin = isWin ? '.venv\\Scripts' : '.venv/bin'
const pip = join(venvBin, isWin ? 'pip.exe' : 'pip3')
const python = join(venvBin, isWin ? 'python.exe' : 'python3')

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`)
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts })
}

const commands = {
  install() {
    if (!existsSync(join(ROOT, 'python', '.venv'))) {
      console.log('[sparta] Creando entorno virtual Python...')
      run('python -m venv .venv', { cwd: join(ROOT, 'python') })
    }
    console.log('[sparta] Instalando dependencias Python...')
    run(`${pip} install -r requirements.txt -r requirements-dev.txt`, { cwd: join(ROOT, 'python') })
    console.log('[sparta] Instalando dependencias Node...')
    run('pnpm install')
    console.log('[sparta] Compilando módulo Rust...')
    if (existsSync(join(ROOT, 'rust', 'sparta-security', 'Cargo.toml'))) {
      run('cargo build --release', { cwd: join(ROOT, 'rust', 'sparta-security') })
    }
    console.log('[sparta] Todo listo.')
  },

  dev() {
    run('pnpm dev')
  },

  build() {
    run('pnpm build')
  },

  test() {
    console.log('[sparta] Tests JS...')
    run('pnpm test')
    console.log('[sparta] Tests Rust...')
    if (existsSync(join(ROOT, 'rust', 'sparta-security', 'Cargo.toml'))) {
      run('cargo test', { cwd: join(ROOT, 'rust', 'sparta-security') })
    }
    console.log('[sparta] Tests Python...')
    run(`${python} -m pytest sparta_ai/tests/ -v`, { cwd: join(ROOT, 'python') })
  },

  lint() {
    run('pnpm lint')
  },

  sidecar() {
    const sub = process.argv[3] || 'run'
    const subcommands = {
      run() { run(`${python} -m sparta_ai.main`, { cwd: join(ROOT, 'python') }) },
      web() { run(`${python} -m sparta_ai.server_web`, { cwd: join(ROOT, 'python') }) },
      test() { run(`${python} -m pytest sparta_ai/tests/ -v`, { cwd: join(ROOT, 'python') }) },
    }
    const fn = subcommands[sub]
    if (fn) fn()
    else console.error(`[sparta] subcomando desconocido: sparta sidecar ${sub}`)
  },
}

const cmd = process.argv[2]
const fn = commands[cmd]
if (fn) {
  fn()
} else {
  console.log(`
Uso: sparta <comando>

Comandos:
  install    Instala todo (Python venv + Node + Rust)
  dev        Inicia el entorno de desarrollo
  build      Compila y empaqueta la app
  test       Ejecuta tests (JS + Rust + Python)
  lint       Ejecuta ESLint
  sidecar    Subcomandos: run, web, test
`)
}
