import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { extractFile, listPackage } from '@electron/asar'
import packageJson from '../package.json' with { type: 'json' }

const releaseRoot = join(process.cwd(), 'release', packageJson.version)

function findAsarFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) return findAsarFiles(entryPath)
    return entry.name === 'app.asar' && statSync(entryPath).isFile() ? [entryPath] : []
  })
}

const archives = findAsarFiles(releaseRoot)
if (archives.length === 0) {
  console.error(`ERROR DE EMPAQUETADO: no se encontrÃ³ app.asar en ${releaseRoot}`)
  process.exit(1)
}

for (const archive of archives) {
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
