import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'

const origin = 'https://download.documentfoundation.org/libreoffice/stable/'
let task: Promise<void> | null = null
let progress: 'idle' | 'downloading' | 'installing' | 'error' = 'idle'
let percent = 0
let latest: { version: string; url: string; sha256: string; size: number } | null = null
let checked = 0
let versionProbe: { executable: string; value: Promise<string | null> } | null = null

function root() { return path.join(app.getPath('userData'), 'components', 'libreoffice') }
function execute(executable: string, args: string[], timeout = 30000) {
  return new Promise<string>((resolve, reject) => execFile(executable, args,
    { windowsHide: true, timeout, maxBuffer: 1024 * 1024 },
    (error, stdout) => error ? reject(error) : resolve(stdout)))
}
export function compareOfficeVersions(a: string, b: string) {
  const left = a.split('.').map(Number), right = b.split('.').map(Number)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0)
    if (difference) return difference
  }
  return 0
}
export async function managedOfficeExecutable(): Promise<string | null> {
  try {
    const value = JSON.parse(await fs.readFile(path.join(root(), 'active.json'), 'utf8'))
    if (!/^\d+\.\d+\.\d+$/.test(value.version)) return null
    const versionRoot = path.join(root(), value.version)
    if (typeof value.executable !== 'string') return null
    const executable = path.resolve(versionRoot, value.executable)
    const relative = path.relative(versionRoot, executable)
    if (relative.startsWith('..') || path.isAbsolute(relative) || !['soffice.com', 'soffice.exe'].includes(path.basename(executable))) return null
    await fs.access(executable)
    return executable
  } catch { return null }
}
async function extractedExecutable(directory: string, depth = 0): Promise<string | null> {
  if (depth > 4) return null
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const executable = entries.find(entry => entry.isFile() && entry.name === 'soffice.com')
  if (executable) return path.join(directory, executable.name)
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const found = await extractedExecutable(path.join(directory, entry.name), depth + 1)
    if (found) return found
  }
  return null
}
async function release() {
  if (latest && Date.now() - checked < 24 * 60 * 60 * 1000) return latest
  const response = await fetch(origin, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('release_unavailable')
  const html = await response.text()
  const versions = [...html.matchAll(/href="(\d+\.\d+\.\d+)\/"/g)].map(match => match[1])
  versions.sort(compareOfficeVersions)
  const version = versions.at(-1)
  if (!version) throw new Error('release_invalid')
  const url = `${origin}${version}/win/x86_64/LibreOffice_${version}_Win_x86-64.msi`
  const metadata = await fetch(`${url}.meta4`, { signal: AbortSignal.timeout(15000) })
  if (!metadata.ok) throw new Error('release_unavailable')
  const xml = await metadata.text()
  const sha256 = xml.match(/<hash type="sha-256">([a-f0-9]{64})<\/hash>/)?.[1]
  const size = Number(xml.match(/<size>(\d+)<\/size>/)?.[1])
  if (!sha256 || size < 1 || size > 600 * 1024 * 1024) throw new Error('release_invalid')
  latest = { version, url, sha256, size }; checked = Date.now()
  return latest
}
export async function officeComponentStatus(check = false) {
  const { findOfficeConverter } = await import('./office-preview')
  const executable = await findOfficeConverter()
  let version: string | null = null
  if (executable && progress !== 'downloading' && progress !== 'installing') {
    if (versionProbe?.executable !== executable) {
      versionProbe = { executable, value: execute(executable, ['--headless', '--version'], 10000)
        .then(value => value.match(/\d+\.\d+\.\d+(?:\.\d+)?/)?.[0] ?? null).catch(() => null) }
    }
    version = await versionProbe.value
  }
  let checkFailed = false
  if (check && process.platform === 'win32' && process.arch === 'x64') {
    try { await release() } catch { checkFailed = true }
  }
  return { installed: !!version, version, latestVersion: latest?.version ?? null,
    updateAvailable: !!version && !!latest && compareOfficeVersions(latest.version, version) > 0,
    supported: process.platform === 'win32' && process.arch === 'x64', progress, percent, checkFailed }
}
export async function installOfficeComponent(onProgress?: (message: string) => void) {
  if (task) return task
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('platform_unsupported')
  task = (async () => {
    let staging: string | null = null
    try {
      const selected = await release()
      await fs.mkdir(root(), { recursive: true })
      staging = await fs.mkdtemp(path.join(root(), 'staging-'))
      const packagePath = path.join(staging, 'office.msi')
      progress = 'downloading'; percent = 0; onProgress?.('LibreOffice: downloading')
      const file = await fs.open(packagePath, 'wx')
      let hash = createHash('sha256'); let received = 0
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(selected.url, {
              signal: AbortSignal.timeout(15 * 60 * 1000),
              headers: received ? { Range: `bytes=${received}-` } : undefined,
            })
            if (!response.ok || !response.body || !response.url.startsWith('https://')) throw new Error('download_failed')
            if (received && response.status === 200) {
              await file.truncate(0); received = 0; hash = createHash('sha256')
            } else if (received && !response.headers.get('content-range')?.startsWith(`bytes ${received}-`)) {
              throw new Error('download_range_invalid')
            }
            for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
              if (received + chunk.length > selected.size) throw new Error('download_size')
              let offset = 0
              while (offset < chunk.length) {
                const result = await file.write(chunk, offset, chunk.length - offset, received + offset)
                if (!result.bytesWritten) throw new Error('download_write_failed')
                offset += result.bytesWritten
              }
              hash.update(chunk); received += chunk.length
              percent = Math.floor(received * 100 / selected.size)
            }
            if (received !== selected.size) throw new Error('download_incomplete')
            break
          } catch (error) {
            if (attempt === 2) throw error
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      } finally { await file.close() }
      if (received !== selected.size || hash.digest('hex') !== selected.sha256) throw new Error('checksum_failed')
      progress = 'installing'; onProgress?.('LibreOffice: preparing local component')
      const image = path.join(staging, 'image')
      await fs.mkdir(image)
      await execute(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'msiexec.exe'),
        ['/a', packagePath, '/qn', '/norestart', `TARGETDIR=${image}`], 10 * 60 * 1000)
      const executable = await extractedExecutable(image)
      if (!executable) throw new Error('executable_missing')
      const version = await execute(executable, ['--headless', '--version'])
      if (!version.includes(selected.version)) throw new Error('verification_failed')
      const destination = path.join(root(), selected.version)
      try { await fs.access(destination) } catch { await fs.rename(image, destination) }
      const marker = path.join(root(), 'active.json.tmp')
      await fs.writeFile(marker, JSON.stringify({ version: selected.version, executable: path.relative(image, executable) }))
      await fs.rename(marker, path.join(root(), 'active.json'))
      versionProbe = { executable: path.join(destination, path.relative(image, executable)), value: Promise.resolve(version.match(/\d+\.\d+\.\d+(?:\.\d+)?/)?.[0] ?? null) }
      progress = 'idle'; percent = 100
    } catch (error) { progress = 'error'; throw error }
    finally {
      if (staging && path.dirname(path.resolve(staging)) === path.resolve(root())) {
        await fs.rm(staging, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 })
          .catch(() => console.warn('[office] Temporary component files remain locked'))
      }
    }
  })()
  try { await task } finally { task = null }
}
