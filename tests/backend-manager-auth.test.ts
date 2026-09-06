import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { BackendManager } from '../desktop/ia-sparta-app-shell/src/backend-manager'
import { isDesktopAuthOrigin } from '../desktop/ia-sparta-app-shell/src/desktop-auth-origin'

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn, execSync: vi.fn() }))
vi.mock('node:fs', () => ({ existsSync: () => true }))
let child: EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: ReturnType<typeof vi.fn> }
beforeEach(() => {
  child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn() })
  mocks.spawn.mockReturnValue(child)
})
afterEach(() => { vi.unstubAllGlobals() })

test('only the trusted renderer origin may request desktop tokens', () => {
  expect(isDesktopAuthOrigin('http://localhost:5173/settings', 'http://localhost:5173')).toBe(true)
  expect(isDesktopAuthOrigin('https://untrusted.example', 'http://localhost:5173')).toBe(false)
  expect(isDesktopAuthOrigin('http://localhost:5174', 'http://localhost:5173')).toBe(false)
  expect(isDesktopAuthOrigin('file:///app/dist/index.html#/chat', 'file:///app/dist/index.html')).toBe(true)
  expect(isDesktopAuthOrigin('file:///tmp/page.html', 'file:///app/dist/index.html')).toBe(false)
  expect(isDesktopAuthOrigin('invalid', 'file:///app/dist/index.html')).toBe(false)
})

test('waits for both the port and split credential, exchanges locally, and clears on stop', async () => {
  const manager = new BackendManager()
  const ready = manager.start('/backend', '/runtime')
  child.stderr.write('TAURI_PORT=12345\n')
  expect(manager.getPort()).toBeUndefined()
  child.stdout.write('SPARTA_DESKTOP_SEC')
  child.stdout.write('RET=desktop-test-secret\n')
  expect(await ready).toBe(12345)
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh', secret: 'must-not-return' })))
  vi.stubGlobal('fetch', fetch)
  expect(await manager.authenticate()).toEqual({ access_token: 'access', refresh_token: 'refresh' })
  expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:12345/api/auth/desktop-login', expect.objectContaining({
    body: JSON.stringify({ secret: 'desktop-test-secret' }), redirect: 'error',
  }))
  manager.stop()
  await expect(manager.authenticate()).rejects.toThrow('Backend is not ready')
})

test('startup errors never include the desktop secret', async () => {
  const manager = new BackendManager()
  const ready = manager.start('/backend', '/runtime')
  child.stdout.write('SPARTA_DESKTOP_SECRET=desktop-private\n')
  child.stderr.write('backend failed')
  child.emit('exit', 1)
  const error = await ready.catch(error => error)
  expect(error.message).toContain('backend failed')
  expect(error.message).not.toContain('desktop-private')
  await expect(manager.authenticate()).rejects.toThrow('Backend is not ready')
})

test('does not return tokens from a rejected exchange', async () => {
  const manager = new BackendManager()
  const ready = manager.start('/backend', '/runtime')
  child.stdout.write('SPARTA_DESKTOP_SECRET=desktop-test\nTAURI_PORT=12345\n')
  await ready
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private server diagnostics', { status: 401 })))
  await expect(manager.authenticate()).rejects.toThrow('Desktop authentication failed (401)')
})
