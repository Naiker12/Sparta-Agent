#!/usr/bin/env node
/**
 * Downloads a standalone CPython build from astral-sh/python-build-standalone
 * into vendor/python-{platform}-{arch}/ for embedding in the Electron app.
 *
 * Usage:
 *   node scripts/fetch-embedded-python.js [--platform <target>] [--version <3.12>]
 *
 * Examples:
 *   node scripts/fetch-embedded-python.js                         # auto-detect host
 *   node scripts/fetch-embedded-python.js --platform win32-x64    # explicit
 *   node scripts/fetch-embedded-python.js --version 3.11          # Python 3.11
 */

const https = require('https')
const fs = require('fs')
const path = require('path')
const { createGunzip } = require('zlib')
const { spawn } = require('child_process')

const ROOT = path.join(__dirname, '..')
const VENDOR_DIR = path.join(ROOT, 'vendor')

// ── CLI args ─────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { platform: null, version: '3.12' }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--platform' && args[i + 1]) opts.platform = args[++i]
    if (args[i] === '--version' && args[i + 1]) opts.version = args[++i]
  }
  return opts
}

// ── Platform detection ───────────────────────────────────────────────
function parsePlatformArg(platformOverride) {
  if (!platformOverride) return { os: process.platform, arch: process.arch }
  // "darwin-arm64" → { os: "darwin", arch: "arm64" }
  // "win32-x64" → { os: "win32", arch: "x64" }
  // "linux-x64" → { os: "linux", arch: "x64" }
  const parts = platformOverride.split('-')
  if (parts.length >= 2) {
    return { os: parts[0], arch: parts[1] }
  }
  return { os: process.platform, arch: process.arch }
}

function detectTarget(platformOverride) {
  const { os, arch } = parsePlatformArg(platformOverride)

  const map = {
    'win32-x64':   'x86_64-pc-windows-msvc',
    'win32-arm64': 'aarch64-pc-windows-msvc',
    'darwin-arm64':'aarch64-apple-darwin',
    'darwin-x64':  'x86_64-apple-darwin',
    'linux-x64':   'x86_64-unknown-linux-gnu',
    'linux-arm64': 'aarch64-unknown-linux-gnu',
  }

  const key = `${os}-${arch}`
  const target = map[key]
  if (!target) {
    console.error(`[fetch-python] Unsupported platform: ${os} ${arch}`)
    process.exit(1)
  }
  return target
}

// ── Vendor dir name for electron-builder ─────────────────────────────
function vendorDirName(platformOverride) {
  const { os, arch } = parsePlatformArg(platformOverride)
  return `python-${os}-${arch}`
}

// ── GitHub API helpers ───────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'sparta-agent' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location).then(resolve, reject)
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
  })
}

function httpGetJson(url) {
  return httpGet(url).then(({ body }) => JSON.parse(body.toString()))
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'sparta-agent' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const file = fs.createWriteStream(dest)
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
      file.on('error', reject)
    })
    req.on('error', reject)
  })
}

// ── Find the correct asset name ─────────────────────────────────────
async function findAsset(tag, cpythonVersion, target) {
  // Use the /releases endpoint (not /releases/tags/) to ensure assets are included
  const url = `https://api.github.com/repos/astral-sh/python-build-standalone/releases/tags/${tag}`
  console.log(`[fetch-python] Fetching release info: ${url}`)

  const { status, body } = await httpGet(url)
  const text = body.toString()

  if (status !== 200) {
    throw new Error(`GitHub API returned HTTP ${status}: ${text.slice(0, 200)}`)
  }

  let release
  try {
    release = JSON.parse(text)
  } catch (e) {
    throw new Error(`Failed to parse GitHub API response: ${text.slice(0, 200)}`)
  }

  if (!release.assets || !Array.isArray(release.assets)) {
    throw new Error(
      `Release ${tag} has no assets array. Response keys: ${Object.keys(release).join(', ')}`
    )
  }

  console.log(`[fetch-python] Release has ${release.assets.length} assets`)

  // Match: cpython-3.12.20+20260623-x86_64-pc-windows-msvc-install_only.tar.gz
  // The version is full (e.g. 3.12.20), and the + separator is literal
  const escapedTarget = target.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  const pattern = new RegExp(
    `cpython-${cpythonVersion.replace('.', '\\.')}[\\w.+]-${escapedTarget}-install_only\\.(tar\\.gz|tar\\.xz|zip)`
  )

  for (const asset of release.assets) {
    if (pattern.test(asset.name)) {
      console.log(`[fetch-python] Matched asset: ${asset.name}`)
      return { name: asset.name, url: asset.browser_download_url }
    }
  }

  // Debug: show some asset names to help diagnose
  const sample = release.assets.slice(0, 5).map((a) => a.name)
  throw new Error(
    `No install_only asset found for CPython ${cpythonVersion} (${target}) in release ${tag}.\n` +
    `Sample assets: ${sample.join(', ')}\n` +
    `Check: https://github.com/astral-sh/python-build-standalone/releases/tag/${tag}`
  )
}

// ── Extract .tar.xz using system tar ────────────────────────────────
function extractTarXz(archivePath, destDir) {
  return new Promise((resolve, reject) => {
    // tar -xf <archive> -C <dest>  (works on macOS/Linux, and Windows with BSDTar)
    const tar = spawn('tar', ['-xf', archivePath, '-C', destDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    tar.stderr.on('data', (d) => { stderr += d.toString() })
    tar.on('close', (code) => {
      if (code !== 0) reject(new Error(`tar exited ${code}: ${stderr}`))
      else resolve()
    })
    tar.on('error', reject)
  })
}

// ── Extract .zip (Windows) ──────────────────────────────────────────
function extractZip(archivePath, destDir) {
  return new Promise((resolve, reject) => {
    // Use PowerShell to extract zip on Windows
    const ps = spawn('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force`,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    ps.stderr.on('data', (d) => { stderr += d.toString() })
    ps.on('close', (code) => {
      if (code !== 0) reject(new Error(`PowerShell zip extract failed: ${stderr}`))
      else resolve()
    })
    ps.on('error', reject)
  })
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs()
  const cpythonVersion = opts.version  // e.g. "3.12"
  const target = detectTarget(opts.platform)
  const vdir = vendorDirName(opts.platform)
  const destDir = path.join(VENDOR_DIR, vdir)

  console.log(`[fetch-python] Target: ${target}`)
  console.log(`[fetch-python] Destination: ${path.relative(ROOT, destDir)}`)

  if (fs.existsSync(path.join(destDir, 'PYTHON.json'))) {
    console.log('[fetch-python] Already downloaded, skipping.')
    return
  }

  // 1. Get latest release tag
  console.log('[fetch-python] Querying latest release...')
  const latest = await httpGetJson(
    'https://raw.githubusercontent.com/astral-sh/python-build-standalone/latest-release/latest-release.json'
  )
  const tag = latest.tag
  console.log(`[fetch-python] Release tag: ${tag}`)

  // 2. Find the right asset
  console.log(`[fetch-python] Looking for CPython ${cpythonVersion} (${target})...`)
  const asset = await findAsset(tag, cpythonVersion, target)
  console.log(`[fetch-python] Asset: ${asset.name}`)

  // 3. Download
  fs.mkdirSync(VENDOR_DIR, { recursive: true })
  const isZip = asset.name.endsWith('.zip')
  const archivePath = path.join(VENDOR_DIR, asset.name)
  console.log(`[fetch-python] Downloading ${asset.url}...`)
  await downloadFile(asset.url, archivePath)
  console.log(`[fetch-python] Downloaded (${(fs.statSync(archivePath).size / 1024 / 1024).toFixed(1)} MB)`)

  // 4. Extract
  console.log('[fetch-python] Extracting...')
  fs.mkdirSync(destDir, { recursive: true })
  if (isZip) {
    await extractZip(archivePath, destDir)
  } else {
    await extractTarXz(archivePath, destDir)
  }

  // 5. The archive extracts into a subdirectory; flatten if needed
  // python-build-standalone extracts to cpython-{ver}+{ts}-{target}/ inside the archive
  const extractedDirs = fs.readdirSync(destDir).filter((d) => d.startsWith('cpython'))
  if (extractedDirs.length === 1) {
    const inner = path.join(destDir, extractedDirs[0])
    for (const entry of fs.readdirSync(inner)) {
      fs.renameSync(path.join(inner, entry), path.join(destDir, entry))
    }
    fs.rmSync(inner, { recursive: true, force: true })
  }

  // 6. Cleanup archive
  fs.rmSync(archivePath, { force: true })

  // 7. Verify
  const pythonBin = process.platform === 'win32'
    ? path.join(destDir, 'Scripts', 'python.exe')
    : path.join(destDir, 'bin', 'python3')

  if (!fs.existsSync(pythonBin)) {
    console.error(`[fetch-python] ERROR: Python binary not found at ${pythonBin}`)
    process.exit(1)
  }

  console.log(`[fetch-python] Python installed: ${pythonBin}`)
  console.log(`[fetch-python] Done. Vendor dir: ${path.relative(ROOT, destDir)}`)
}

main().catch((err) => {
  console.error('[fetch-python] Fatal error:', err.message)
  process.exit(1)
})
