import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'

const extensions = new Set(['ppt', 'pptx', 'odp', 'doc', 'odt', 'rtf'])
const limit = 25 * 1024 * 1024

export async function findOfficeConverter(): Promise<string | null> {
  const candidates = [process.env.SPARTAN_OFFICE_CONVERTER]
  const { managedOfficeExecutable } = await import('./office-component')
  candidates.push(await managedOfficeExecutable() ?? undefined)
  if (process.platform === 'win32') {
    for (const root of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
      if (root) candidates.push(path.join(root, 'LibreOffice', 'program', 'soffice.com'), path.join(root, 'LibreOffice', 'program', 'soffice.exe'))
    }
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/LibreOffice.app/Contents/MacOS/soffice')
  } else candidates.push('/usr/bin/libreoffice', '/usr/bin/soffice')
  for (const candidate of candidates) {
    if (!candidate || !path.isAbsolute(candidate)) continue
    try { await fs.access(candidate); return candidate } catch { /* Try next installation. */ }
  }
  return null
}

export async function convertOfficePreview(request: { filename: string; bytes: Uint8Array }) {
  if (!request || typeof request.filename !== 'string' || !(request.bytes instanceof Uint8Array)) {
    return { ok: false as const, error: 'invalid_input' }
  }
  const extension = path.extname(request.filename).slice(1).toLowerCase()
  if (!extensions.has(extension) || !request.bytes.length || request.bytes.length > limit) {
    return { ok: false as const, error: 'invalid_input' }
  }
  const executable = await findOfficeConverter()
  if (!executable) return { ok: false as const, error: 'converter_missing' }
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'spartan-office-'))
  try {
    const input = path.join(directory, `document.${extension}`)
    await fs.writeFile(input, request.bytes)
    // A separate profile prevents connecting to or modifying an open Office session.
    const profile = path.join(directory, 'profile')
    await fs.mkdir(profile)
    await fs.mkdir(path.join(profile, 'user'))
    // Disable macros in the isolated conversion profile.
    await fs.writeFile(path.join(profile, 'user', 'registrymodifications.xcu'),
      '<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item></oor:items>')
    await new Promise<void>((resolve, reject) => {
      execFile(executable, [
        `-env:UserInstallation=${pathToFileURL(profile).href}`,
        '--headless', '--nologo', '--nodefault', '--norestore',
        '--convert-to', 'pdf', '--outdir', directory, input,
      ], { windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024 },
      (error) => error ? reject(error) : resolve())
    })
    const output = path.join(directory, 'document.pdf')
    const stat = await fs.stat(output)
    if (stat.size > limit) throw new Error('output_too_large')
    const bytes = await fs.readFile(output)
    if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('invalid_output')
    return { ok: true as const, bytes: new Uint8Array(bytes) }
  } catch (error) {
    console.warn('[office] Conversion failed', error instanceof Error ? error.message : 'unknown_error')
    return { ok: false as const, error: 'conversion_failed' }
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
}
