import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const directory = path.resolve('output/office-runtime-validation')
await fs.mkdir(directory, { recursive: true })
const stub = path.join(directory, 'electron-stub.mjs')
await fs.writeFile(stub, `export const app = { getPath: () => ${JSON.stringify(directory)} };`)
const bundle = path.join(directory, 'office-component.mjs')
await build({ entryPoints: ['desktop/ia-sparta-ipc-bridge/src/channels/office-component.ts'],
  outfile: bundle, bundle: true, platform: 'node', format: 'esm', alias: { electron: stub } })
const module = await import(pathToFileURL(bundle).href)
let previous = ''
const timer = setInterval(async () => {
  const state = await module.officeComponentStatus()
  const message = `${state.progress} ${state.percent}%`
  if (message !== previous) { console.log(message); previous = message }
}, 5000)
try {
  if (!(await module.managedOfficeExecutable())) await module.installOfficeComponent(console.log)
  const executable = await module.managedOfficeExecutable()
  if (!executable) throw new Error('Component executable missing')
  process.env.SPARTAN_OFFICE_CONVERTER = executable
  const previewBundle = path.join(directory, 'office-preview.mjs')
  await build({ entryPoints: ['desktop/ia-sparta-ipc-bridge/src/channels/office-preview.ts'],
    outfile: previewBundle, bundle: true, platform: 'node', format: 'esm', alias: { electron: stub } })
  const preview = await import(pathToFileURL(previewBundle).href)
  const fixture = process.argv[2]
  const filename = fixture ? path.basename(fixture) : 'sample.rtf'
  const bytes = fixture ? await fs.readFile(fixture) : Buffer.from('{\\rtf1\\ansi Spartan document conversion test.}')
  const result = await preview.convertOfficePreview({ filename, bytes: new Uint8Array(bytes) })
  if (!result.ok || !result.bytes) throw new Error(`Conversion failed: ${result.error}`)
  await fs.writeFile(path.join(directory, `converted-${path.extname(filename).slice(1)}.pdf`), result.bytes)
  console.log(JSON.stringify(await module.officeComponentStatus()))
  console.log(`Converted PDF: ${result.bytes.length} bytes`)
} finally { clearInterval(timer) }
