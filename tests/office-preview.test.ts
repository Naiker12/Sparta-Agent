import { beforeEach, expect, test, vi } from 'vitest'
import { convertOfficePreview } from '../desktop/ia-sparta-ipc-bridge/src/channels/office-preview'

const mocks = vi.hoisted(() => ({ execFile: vi.fn(), access: vi.fn(), rm: vi.fn(), readFile: vi.fn() }))
vi.mock('node:child_process', () => ({ execFile: mocks.execFile }))
vi.mock('../desktop/ia-sparta-ipc-bridge/src/channels/office-component', () => ({ managedOfficeExecutable: async () => null }))
vi.mock('node:fs/promises', () => ({ default: {
  access: mocks.access, rm: mocks.rm, readFile: mocks.readFile,
  mkdtemp: vi.fn(async () => '/tmp/spartan-office-fixture'),
  mkdir: vi.fn(), writeFile: vi.fn(), stat: vi.fn(async () => ({ size: 25 })),
} }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SPARTAN_OFFICE_CONVERTER', process.platform === 'win32' ? 'C:\\Office\\soffice.exe' : '/office/soffice')
  mocks.access.mockResolvedValue(undefined)
  mocks.execFile.mockImplementation((_exe, _args, _options, callback) => callback(null))
  mocks.readFile.mockResolvedValue(Buffer.from('%PDF-1.7 test document'))
})
test('rejects unsupported input before executing a process', async () => {
  expect(await convertOfficePreview({ filename: '../run.exe', bytes: new Uint8Array([1]) })).toEqual({ ok: false, error: 'invalid_input' })
  expect(mocks.execFile).not.toHaveBeenCalled()
})
test('reports an absent converter without creating a process', async () => {
  mocks.access.mockRejectedValue(new Error('missing'))
  expect(await convertOfficePreview({ filename: 'slides.pptx', bytes: new Uint8Array([1]) })).toEqual({ ok: false, error: 'converter_missing' })
  expect(mocks.execFile).not.toHaveBeenCalled()
})
test.each(['ppt', 'pptx', 'odp', 'doc', 'odt', 'rtf'])('converts %s using an isolated profile and fixed input filename', async (extension) => {
  const result = await convertOfficePreview({ filename: `../../name with spaces.${extension}`, bytes: new Uint8Array([1]) })
  expect(result.ok).toBe(true)
  const [, args, options] = mocks.execFile.mock.calls[0]
  expect(args).toContain('--headless')
  expect(args[0]).toMatch(/UserInstallation=file:/)
  expect(args.at(-1)).not.toContain('name with spaces')
  expect(options).toMatchObject({ windowsHide: true, timeout: 60000 })
  expect(mocks.rm).toHaveBeenCalledWith('/tmp/spartan-office-fixture', { recursive: true, force: true })
})
test('cleans temporary files on process failure', async () => {
  mocks.execFile.mockImplementation((_exe, _args, _options, callback) => callback(new Error('timeout')))
  expect(await convertOfficePreview({ filename: 'old.doc', bytes: new Uint8Array([1]) })).toEqual({ ok: false, error: 'conversion_failed' })
  expect(mocks.rm).toHaveBeenCalled()
})
test('rejects output that is not a PDF', async () => {
  mocks.readFile.mockResolvedValue(Buffer.from('an error message'))
  expect((await convertOfficePreview({ filename: 'old.doc', bytes: new Uint8Array([1]) })).ok).toBe(false)
})
