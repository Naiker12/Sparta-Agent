import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { extractFile, listPackage } from '@electron/asar'
import packageJson from '../package.json' with { type: 'json' }

// Accept either a concrete app.asar or a release directory. CI passes the
// directory produced by electron-builder, which prevents an old local release
// from being mistaken for the artifact about to be published.
const requestedTarget = process.argv[2] || process.env.SPARTA_PACKAGED_OUTPUT
const releaseRoot = requestedTarget
  ? resolve(process.cwd(), requestedTarget)
  : join(process.cwd(), 'release', packageJson.version)

function findAsarFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) return findAsarFiles(entryPath)
    return entry.name === 'app.asar' && statSync(entryPath).isFile() ? [entryPath] : []
  })
}

const archives = existsSync(releaseRoot) && statSync(releaseRoot).isFile()
  ? [releaseRoot]
  : findAsarFiles(releaseRoot)
if (archives.length === 0) {
  console.error(`ERROR DE EMPAQUETADO: no se encontró app.asar en ${releaseRoot}`)
  process.exit(1)
}

for (const archive of archives) {
  for (const removed of ['install_llama_prebuilt.py', 'install_whisper_prebuilt.py', 'vendor/unsloth-installers', 'routes/whisper.py', 'routes/rag.py', 'routes/export.py']) {
    if (existsSync(join(dirname(archive), 'backend', removed))) {
      throw new Error(`Unexpected local-model resource in API-only package: ${removed}`)
    }
  }
  for (const required of ['run.py', 'requirements/studio.txt']) {
    if (!existsSync(join(dirname(archive), 'backend', required))) {
      throw new Error(`Missing packaged API backend resource: ${required}`)
    }
  }
  const entries = listPackage(archive).map((entry) => entry.replaceAll('\\', '/'))
  for (const required of ['/dist/index.html', '/dist-electron/electron-main.js', '/package.json']) {
    if (!entries.some((entry) => entry.endsWith(required))) {
      console.error(`ERROR DE EMPAQUETADO: ${required} falta en ${archive}`)
      process.exit(1)
    }
  }

  const manifest = JSON.parse((await extractFile(archive, 'package.json')).toString())
  if (manifest.version !== packageJson.version) {
    console.error(`ERROR DE VERSION: ${archive} contiene ${manifest.version}, se esperaba ${packageJson.version}`)
    process.exit(1)
  }
  console.log(`OK: ${archive} contiene renderer, proceso principal y version ${manifest.version}.`)
}
