import { afterEach, expect, test, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { compareOfficeVersions, managedOfficeExecutable } from '../desktop/ia-sparta-ipc-bridge/src/channels/office-component'
const state = vi.hoisted(() => ({ directory: '' }))
vi.mock('electron', () => ({ app: { getPath: () => state.directory } }))
afterEach(async () => {
  if (state.directory && path.dirname(state.directory) === os.tmpdir()) await fs.rm(state.directory, { recursive: true, force: true })
})
test('compares versions numerically including maintenance revisions', () => {
  expect(compareOfficeVersions('26.8.1', '26.2.6')).toBeGreaterThan(0)
  expect(compareOfficeVersions('26.8.1', '26.8.1.3')).toBeLessThan(0)
  expect(compareOfficeVersions('26.8.10', '26.8.9')).toBeGreaterThan(0)
})
test('managed executable must stay inside its version directory', async () => {
  state.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'spartan-office-test-'))
  const root = path.join(state.directory, 'components', 'libreoffice')
  await fs.mkdir(root, { recursive: true })
  await fs.writeFile(path.join(root, 'active.json'), JSON.stringify({ version: '26.8.1', executable: '../../soffice.exe' }))
  expect(await managedOfficeExecutable()).toBeNull()
})
test('recognizes a verified executable under a variable extraction folder', async () => {
  state.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'spartan-office-test-'))
  const root = path.join(state.directory, 'components', 'libreoffice')
  const relative = path.join('LibreOffice 26', 'program', 'soffice.exe')
  await fs.mkdir(path.dirname(path.join(root, '26.8.1', relative)), { recursive: true })
  await fs.writeFile(path.join(root, '26.8.1', relative), '')
  await fs.writeFile(path.join(root, 'active.json'), JSON.stringify({ version: '26.8.1', executable: relative }))
  expect(await managedOfficeExecutable()).toBe(path.join(root, '26.8.1', relative))
})
