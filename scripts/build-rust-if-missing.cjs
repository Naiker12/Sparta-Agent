const { existsSync } = require('fs')
const { execSync } = require('child_process')
const path = require('path')

function getTargetTriple() {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'win32' && arch === 'x64') return 'win32-x64-msvc'
  if (platform === 'win32' && arch === 'arm64') return 'win32-arm64-msvc'
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64'
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64'
  if (platform === 'linux' && arch === 'x64') return 'linux-x64-gnu'
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64-gnu'

  throw new Error(`[rust] Unsupported platform/arch for native build: ${platform} ${arch}`)
}

function main() {
  const triple = getTargetTriple()
  const target = path.join(__dirname, '..', 'rust', 'sparta-security', `sparta-security.${triple}.node`)

  if (!existsSync(target)) {
    console.log(`[rust] sparta-security binary missing for ${triple}, trying to build...`)
    try {
      execSync('npm run rust:napi', { stdio: 'inherit', cwd: path.join(__dirname, '..') })
      if (!existsSync(target)) {
        console.warn(`[rust] Build completed but expected binary was not produced at ${target}; continuing without native module.`)
      }
    } catch (error) {
      console.warn(`[rust] Native build skipped: ${(error).message}`)
      console.warn('[rust] Continuing without native module; the app will run in fallback mode.')
    }
  } else {
    console.log(`[rust] sparta-security binary already built (${triple}), skipping.`)
  }
}

main()
