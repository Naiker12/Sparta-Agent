import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  packaged: true, configured: true, downloaded: null as string | null,
  handlers: new Map<string, (...args: any[]) => any>(),
  check: vi.fn(), send: vi.fn(), unlink: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { get isPackaged() { return mock.packaged; }, getPath: () => '/fixture-profile', getVersion: () => '0.3.3' },
  ipcMain: { handle: (key: string, handler: (...args: any[]) => any) => mock.handlers.set(key, handler) },
}));
vi.mock('electron-updater', () => ({ autoUpdater: {
  on: vi.fn(), checkForUpdates: mock.check, downloadUpdate: vi.fn(), quitAndInstall: vi.fn(),
} }));
vi.mock('node:fs', () => ({
  existsSync: (file: string) => file.endsWith('app-update.yml') ? mock.configured : mock.downloaded !== null,
  readFileSync: () => JSON.stringify({ downloadedVersion: mock.downloaded }),
  unlinkSync: mock.unlink, writeFileSync: vi.fn(),
}));

import { setupAutoUpdater } from '../desktop/ia-sparta-app-shell/src/auto-updater';

const resourcesDescriptor = Object.getOwnPropertyDescriptor(process, 'resourcesPath');
beforeAll(() => Object.defineProperty(process, 'resourcesPath', { value: '/fixture-resources', configurable: true }));
afterAll(() => {
  if (resourcesDescriptor) Object.defineProperty(process, 'resourcesPath', resourcesDescriptor);
  else Reflect.deleteProperty(process, 'resourcesPath');
});
beforeEach(() => {
  mock.packaged = true; mock.configured = true; mock.downloaded = null;
  mock.handlers.clear(); mock.check.mockReset().mockResolvedValue(null);
  mock.send.mockReset(); mock.unlink.mockReset();
});
const setup = () => setupAutoUpdater(() => ({ webContents: { send: mock.send } }) as never);

test('directory builds without metadata neither check automatically nor expose a filesystem error on retry', async () => {
  mock.configured = false;
  setup();
  expect(mock.check).not.toHaveBeenCalled();
  expect(await mock.handlers.get('updater:check')!()).toEqual({ ok: false, error: 'Automatic updates are unavailable in this build' });
  expect(mock.check).not.toHaveBeenCalled();
  expect(mock.send).not.toHaveBeenCalled();
});

test('configured packaged distributions retain automatic and manual update checks', async () => {
  setup();
  expect(mock.check).toHaveBeenCalledTimes(1);
  expect(await mock.handlers.get('updater:check')!()).toEqual({ ok: true });
  expect(mock.check).toHaveBeenCalledTimes(2);
});

test('development stays disabled even when metadata exists', async () => {
  mock.packaged = false;
  setup();
  expect(mock.check).not.toHaveBeenCalled();
  expect((await mock.handlers.get('updater:check')!()).ok).toBe(false);
});

test('installed-version guard still consumes its marker and skips the first automatic check', () => {
  mock.downloaded = '0.3.3';
  setup();
  expect(mock.check).not.toHaveBeenCalled();
  expect(mock.unlink).toHaveBeenCalledOnce();
});

test('automatic check failures are handled as state rather than an unhandled rejection', async () => {
  mock.check.mockRejectedValue(new Error('Offline'));
  setup();
  await Promise.resolve();
  expect(mock.send).toHaveBeenCalledWith('updater:state', { stage: 'error', error: 'Offline' });
});
