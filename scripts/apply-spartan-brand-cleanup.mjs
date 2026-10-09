import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const candidates = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const changed = [];
const selectors = [...new Set([...fs.readFileSync('desktop/frontend-spartan/src/index.css', 'utf8').matchAll(/\.((?:unsloth-)[a-z0-9-]+)/g)].map(match => match[1]))];
for (const relative of candidates) {
  if (!/\.(tsx?|css|mjs|html|cjs)$/.test(relative) || !/^(desktop\/frontend-spartan\/|desktop\/ia-sparta-app-shell\/|landing\/src\/|tests\/|scripts\/|electron-builder)/.test(relative)) continue;
  const file = path.resolve(root, relative);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  after = after.replaceAll('unslothLightTheme', 'spartanLightTheme').replaceAll('unslothDarkTheme', 'spartanDarkTheme').replaceAll('"unsloth-light"', '"spartan-light"').replaceAll('"unsloth-dark"', '"spartan-dark"');
  for (const selector of selectors) after = after.replaceAll(selector, selector.replace('unsloth-', 'spartan-'));
  after = after.replaceAll('classifyUnslothSupport', 'classifyModelSupport').replaceAll('UnslothSupportStatus', 'ModelSupportStatus').replaceAll('UnslothSupport', 'ModelSupport').replaceAll('lib/unsloth-support', 'lib/model-support');
  if (/desktop\/ia-sparta-app-shell\/|electron-builder/.test(relative)) after = after.replaceAll('Sparta Agent', 'Spartan');
  if (/desktop\/frontend-spartan\/src\/|desktop\/frontend-spartan\/index.html/.test(relative)) {
    after = after.split('\n').map(line => /copyright|license/i.test(line) ? line : line.replaceAll('Sparta Agent', 'Spartan').replaceAll('Spartan Agent', 'Spartan')).join('\n');
  }
  if (/i18n\/locales\/[^/]+\/shell\.ts$/.test(relative)) {
    after = after.replace(/brand: "[^"]+"/, 'brand: "Spartan"').replace(/product: "[^"]+"/, 'product: "Spartan"');
  }
  if (/i18n\/locales\/[^/]+\/ui\.ts$/.test(relative)) {
    // Only change display values, never persisted keys or upstream identifiers.
    after = after.replace(/^(\s*"[^"]+": )(.*)$/gm, (line, key, value) => {
      if (/legacy_verified_unsloth|legacy_other_non_unsloth_models|legacy_no_matching_unsloth_models/.test(key)) {
        const spanish = relative.includes('/es/');
        const display = key.includes('legacy_verified') ? (spanish ? 'Editor verificado' : 'Verified publisher') : key.includes('legacy_other') ? (spanish ? 'Otros modelos del catálogo' : 'Other models') : (spanish ? 'No hay modelos que coincidan.' : 'No matching models.');
        return key + JSON.stringify(display) + (value.trim().endsWith(',') ? ',' : '');
      }
      if (/run_unsloth_studio_update|speech_to_text_is_not_available/.test(key)) {
        return key + value.replaceAll('`unsloth studio update`', 'la configuración de voz de Spartan').replaceAll('Run la configuración de voz de Spartan to install it.', 'Configure a transcription provider in Spartan voice settings.').replaceAll('Ejecuta la configuración de voz de Spartan para instalarlo', 'Configura un proveedor en los ajustes de voz de Spartan').replaceAll('Run la configuración de voz de Spartan to install it, then choose a model in Voice settings.', 'Configure a transcription provider and model in Spartan voice settings.');
      }
      if (!/copyright/i.test(value) && /legacy_/.test(key)) value = value.replaceAll('Unsloth', 'Spartan');
      return key + value;
    });
  }
  if (after !== before) { fs.writeFileSync(file, after); changed.push(relative); }
}
const renames = [
  ['desktop/frontend-spartan/src/features/hub/lib/unsloth-support.ts', 'desktop/frontend-spartan/src/features/hub/lib/model-support.ts'],
  ['desktop/frontend-spartan/tests/unsloth-support-companion-mirror.test.ts', 'desktop/frontend-spartan/tests/model-support-companion-mirror.test.ts'],
];
for (const [from, to] of renames) {
  if (fs.existsSync(from) && !fs.existsSync(to)) fs.renameSync(from, to);
}
const removed = [
  'desktop/frontend-spartan/src/components/example.tsx',
  'desktop/frontend-spartan/src/features/chat/thread-sidebar.tsx',
  'desktop/frontend-spartan/src/components/gallery-item-menu.tsx',
  'desktop/frontend-spartan/tests/gallery-item-menu-visibility.test.ts',
  'desktop/frontend-spartan/src/features/hub/lib/channels.ts',
];
for (const relative of removed) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) throw new Error('Outside workspace');
  if (fs.existsSync(target)) fs.unlinkSync(target);
}
fs.mkdirSync('output/cleanup', { recursive: true });
const previous = fs.existsSync('output/cleanup/changes.json') ? JSON.parse(fs.readFileSync('output/cleanup/changes.json', 'utf8')) : {};
fs.writeFileSync('output/cleanup/changes.json', JSON.stringify({ changed: [...new Set([...(previous.changed ?? []), ...changed])], renames, removed }, null, 2));
console.log(JSON.stringify({ changedFiles: changed.length, renames, removed }, null, 2));
