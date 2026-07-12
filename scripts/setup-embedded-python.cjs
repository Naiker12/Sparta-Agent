#!/usr/bin/env node
/**
 * Installs Sparta Agent's Python dependencies into the embedded Python
 * distribution downloaded by fetch-embedded-python.js.
 *
 * Usage:
 *   node scripts/setup-embedded-python.js [--platform <target>]
 *
 * This runs pip install inside the standalone Python so the sidecar
 * can work without requiring the user to have Python installed.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const VENDOR_DIR = path.join(ROOT, 'vendor')
const REQUIREMENTS = path.join(ROOT, 'python', 'requirements.txt')

// ── CLI args ─────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2)
  let platform = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--platform' && args[i + 1]) platform = args[++i]
  }
  return { platform }
}

// ── Vendor dir name (matches fetch-embedded-python.cjs) ──────────────
function vendorDirName(platformOverride) {
  if (!platformOverride) return `python-${process.platform}-${process.arch}`
  const parts = platformOverride.split('-')
  return `python-${parts[0]}-${parts[1]}`
}

// ── Find the Python binary inside the vendor dir ─────────────────────
function findPythonBin(vendorDir) {
  const candidates = process.platform === 'win32'
    ? [
        path.join(vendorDir, 'python.exe'),
        path.join(vendorDir, 'Scripts', 'python.exe'),
      ]
    : [
        path.join(vendorDir, 'bin', 'python3'),
        path.join(vendorDir, 'bin', 'python'),
      ]

  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

// ── Detect Python version from the binary ────────────────────────────
function detectPythonVersion(pythonBin) {
  const out = execSync(`"${pythonBin}" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
  return out // e.g. "3.12"
}

// ── Main ─────────────────────────────────────────────────────────────
function main() {
  const { platform } = parseArgs()
  const vdir = vendorDirName(platform)
  const vendorDir = path.join(VENDOR_DIR, vdir)

  console.log(`[setup-python] Vendor dir: ${path.relative(ROOT, vendorDir)}`)

  if (!fs.existsSync(vendorDir)) {
    console.error(`[setup-python] ERROR: Vendor dir not found. Run fetch-embedded-python.js first.`)
    process.exit(1)
  }

  const pythonBin = findPythonBin(vendorDir)
  if (!pythonBin) {
    console.error(`[setup-python] ERROR: Python binary not found in ${vendorDir}`)
    process.exit(1)
  }

  console.log(`[setup-python] Python: ${pythonBin}`)

  const pyVersion = detectPythonVersion(pythonBin)
  console.log(`[setup-python] Python version: ${pyVersion}`)

  if (!fs.existsSync(REQUIREMENTS)) {
    console.error(`[setup-python] ERROR: ${path.relative(ROOT, REQUIREMENTS)} not found`)
    process.exit(1)
  }

  // Target directory for pip install — puts packages where the embedded
  // Python can find them via its default sys.path
  const sitePackages = process.platform === 'win32'
    ? path.join(vendorDir, 'Lib', 'site-packages')
    : path.join(vendorDir, 'lib', `python${pyVersion}`, 'site-packages')

  fs.mkdirSync(sitePackages, { recursive: true })

  console.log(`[setup-python] Installing dependencies from requirements.txt...`)
  console.log(`[setup-python] Target: ${path.relative(ROOT, sitePackages)}`)

  const pipCmd = [
    `"${pythonBin}"`, '-m', 'pip', 'install',
    '--quiet',
    '--no-warn-script-location',
    '-r', `"${REQUIREMENTS}"`,
    '--target', `"${sitePackages}"`,
  ].join(' ')

  try {
    execSync(pipCmd, {
      stdio: 'inherit',
      cwd: ROOT,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    })
  } catch (err) {
    console.error(`[setup-python] pip install failed`)
    process.exit(1)
  }

  console.log(`[setup-python] Done. Dependencies installed to site-packages.`)

  // Write a marker so we can detect if setup needs to be re-run
  const markerPath = path.join(vendorDir, '.setup-complete')
  fs.writeFileSync(markerPath, JSON.stringify({
    pythonVersion: pyVersion,
    requirementsHash: require('crypto')
      .createHash('md5')
      .update(fs.readFileSync(REQUIREMENTS))
      .digest('hex'),
    timestamp: new Date().toISOString(),
  }, null, 2))
}

main()
