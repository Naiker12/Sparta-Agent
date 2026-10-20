import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.join(root, 'desktop/frontend-spartan');
const {build} = createRequire(path.join(frontend, 'package.json'))('esbuild');
const result = await build({
  stdin: {contents: `export {syncNativeTitlebar, setTheme, setPalette} from './src/features/settings/stores/theme-store';`, resolveDir: frontend},
  bundle: true, write: false, format: 'iife', globalName: 'themeTitlebar', platform: 'browser',
});
const browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {channel: 'msedge'} : {})});
try {
  const page = await browser.newPage();
  await page.setContent(`<style>
    :root {--background: #f2ebe0; --foreground: oklch(0.2686 0 0)}
    .dark {--background: #181818; --foreground: #ececec}
    [data-palette="minimal"] {--background: oklch(1 0 0); --foreground: #171717}
  </style>`);
  await page.evaluate(() => {
    window.overlays = [];
    window.electronAPI = {setTitleBarOverlay: colors => window.overlays.push(colors)};
  });
  await page.addScriptTag({content: result.outputFiles[0].text});
  await page.evaluate(() => themeTitlebar.syncNativeTitlebar());
  assert.deepEqual(await page.evaluate(() => window.overlays.at(-1)), {color:'#f2ebe0', symbolColor:'#262626'});
  await page.evaluate(() => themeTitlebar.setTheme('dark'));
  await page.waitForFunction(() => window.overlays.at(-1)?.color === '#181818');
  assert.deepEqual(await page.evaluate(() => window.overlays.at(-1)), {color:'#181818', symbolColor:'#ececec'});
  await page.evaluate(() => {themeTitlebar.setTheme('light'); themeTitlebar.setPalette('minimal')});
  await page.waitForFunction(() => window.overlays.at(-1)?.color === '#ffffff');
  assert.deepEqual(await page.evaluate(() => window.overlays.at(-1)), {color:'#ffffff', symbolColor:'#171717'});
  await page.evaluate(() => {
    delete window.electronAPI;
    window.electron = {send: (channel, colors) => window.legacyOverlay = {channel, colors}};
    themeTitlebar.syncNativeTitlebar();
  });
  assert.deepEqual(await page.evaluate(() => window.legacyOverlay), {channel:'titlebar:set-overlay',colors:{color:'#ffffff',symbolColor:'#171717'}});
  assert.equal(await page.locator('span').count(), 0, 'temporary color probe is removed');
  console.log('Native titlebar colors: light, dark, palette changes and legacy IPC passed.');
} finally {
  await browser.close();
}
