import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFrontend = createRequire(path.join(root, 'desktop/frontend-spartan/package.json'));
const { build } = requireFrontend('esbuild');
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sparta-electron-smoke-'));
const dist = path.join(root, 'desktop/frontend-spartan/dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(dist + path.sep)) { response.writeHead(403).end(); return; }
    const bytes = await fs.readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(bytes);
  } catch { response.writeHead(404).end(); }
});
let electron;
let page;
const errors = [];
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  await build({ entryPoints: [path.join(root, 'desktop/ia-sparta-ipc-bridge/src/electron-preload.ts')], outfile: path.join(directory, 'preload.cjs'), bundle: true, platform: 'node', format: 'cjs', external: ['electron'] });
  const url = `http://127.0.0.1:${server.address().port}`;
  await fs.writeFile(path.join(directory, 'main.cjs'), `
    const {app,BrowserWindow,ipcMain}=require('electron');
    app.setPath('userData',${JSON.stringify(path.join(directory, 'profile'))});
    app.commandLine.appendSwitch('lang','es');
    ipcMain.handle('backend:get-port',()=>undefined);
    ipcMain.handle('backend:get-status',()=>({error:'El backend local aún no está preparado'}));
    ipcMain.handle('backend:bootstrap',()=>({ok:false,error:'Fallo controlado de preparación'}));
    ipcMain.handle('app:getVersion',()=>app.getVersion());
    app.whenReady().then(()=>{const window=new BrowserWindow({show:false,webPreferences:{preload:${JSON.stringify(path.join(directory, 'preload.cjs'))},contextIsolation:true,nodeIntegration:false,sandbox:true}});window.loadURL(${JSON.stringify(url)});});
  `);
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  electron = await _electron.launch({ args: [path.join(directory, 'main.cjs')], env: environment, timeout: 30_000 });
  page = await electron.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('button', { name: 'Entrar a Sparta' }).click({ timeout: 30_000 });
  await page.getByRole('heading', { name: 'Prepara Spartan' }).waitFor({ timeout: 30_000 });
  assert.equal(await page.getByText('Backend pendiente', { exact: true }).count(), 1);
  assert.ok(await page.getByAltText('Logo de Spartan').evaluate(image => image.complete && image.naturalWidth > 0));
  const result = await page.evaluate(async () => ({
    version: await window.electronAPI.getVersion(),
    isolated: typeof window.require === 'undefined',
    blocked: await window.electron.invoke('unapproved:channel').then(() => false, () => true),
  }));
  assert.equal(result.isolated, true);
  assert.equal(result.blocked, true);
  assert.ok(result.version);
  await page.getByRole('button', { name: /Instalar|Preparar|Reintentar/ }).click();
  await page.getByRole('button', { name: 'Ver detalles técnicos' }).click();
  await page.getByText('Fallo controlado de preparación', { exact: true }).last().waitFor();
  assert.deepEqual(errors, []);
  console.log('Electron: arranque aislado, preload real, logo, rechazo IPC y recuperación de fallo de preparación correctos. Backend y proveedor no ejecutados.');
} catch (error) {
  if (page) console.error(JSON.stringify({ title: await page.title(), text: (await page.locator('body').innerText()).slice(0, 1500), errors }));
  throw error;
} finally {
  await electron?.close();
  await new Promise(resolve => server.close(resolve));
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('sparta-electron-smoke-')) throw new Error('Unexpected temporary path');
  await fs.rm(resolved, { recursive: true, force: true });
}
