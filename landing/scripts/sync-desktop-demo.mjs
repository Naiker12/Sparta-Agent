import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const landing = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(landing, '../desktop/frontend-spartan/src/index.css'), 'utf8');
const lightStart = source.indexOf('--background: #f2ebe0');
const darkStart = source.indexOf('--background: #181818');
const tokens = {bg:'background',card:'card',sidebar:'sidebar',border:'border',text:'foreground',muted:'muted-foreground',primary:'primary',secondary:'secondary'};
function theme(start,mode) {
 if(start<0)throw new Error('Desktop theme not found: '+mode);
 const block=source.slice(start,source.indexOf('}',start));
 const rules=Object.entries(tokens).map(([demo,desktop])=>{
  const match=block.match(new RegExp('--'+desktop+':\\s*([^;]+);'));
  if(!match)throw new Error('Missing desktop token '+desktop);
  return '  --demo-'+demo+': '+match[1]+';';
 });
 return '.sparta-preview[data-demo-theme="'+mode+'"] {\n'+rules.join('\n')+'\n}';
}
const css='/* Generated from desktop/src/index.css. Run npm run demo:sync. */\n'+theme(lightStart,'light')+'\n'+theme(darkStart,'dark')+'\n';
fs.writeFileSync(path.join(landing,'src/styles/desktop-demo-theme.css'),css);
const palettes = {};
for (const palette of ['standard', 'classic', 'minimal']) {
 palettes[palette] = {};
 for (const mode of ['light', 'dark']) {
  const baseStart = mode === 'light' ? lightStart : darkStart;
  const base = source.slice(baseStart, source.indexOf('}', baseStart));
  const marker = ':root[data-palette="'+palette+'"]'+(mode === 'light' ? ':not(.dark)' : '.dark');
  const start = source.indexOf(marker);
  if (palette !== 'standard' && start < 0) throw new Error('Missing desktop palette: '+marker);
  const override = start < 0 ? '' : source.slice(start, source.indexOf('}', start));
  const values = Object.fromEntries(Object.entries(tokens).map(([demo, desktop]) => {
   const pattern = new RegExp('--'+desktop+':\\s*([^;]+);');
   return [demo, (override.match(pattern) || base.match(pattern))[1]];
  }));
  values.primary = palette === 'classic' ? override.match(/--control-accent:\s*([^;]+);/)[1] : values.primary;
  if (palette === 'standard' && mode === 'light') values.text = '#262626';
  palettes[palette][mode] = values;
 }
}
fs.writeFileSync(path.join(landing, 'src/components/landing/desktop-palettes.generated.ts'), '// Generated from desktop index.css by npm run demo:sync.\nexport const DESKTOP_PALETTES = '+JSON.stringify(palettes, null, 2)+' as const;\n');
// Copy the pure definitions without pulling the desktop translation/store graph.
const shortcutsSource = fs.readFileSync(path.join(landing, '../desktop/frontend-spartan/src/features/settings/lib/keyboard-shortcuts.ts'), 'utf8');
const definitions = shortcutsSource.slice(shortcutsSource.indexOf('export const SHORTCUT_DEFS:'), shortcutsSource.indexOf('export const SHORTCUT_DEF_BY_ID:'));
const shortcuts = [...definitions.matchAll(/id:\s*"([^"]+)"[\s\S]*?defaultBinding:\s*"([^"]+)"/g)].map(match => ({ id: match[1], defaultBinding: match[2] }));
if (shortcuts.length !== 5) throw new Error('Desktop shortcut definitions changed; review the demo adapter.');
fs.writeFileSync(path.join(landing, 'src/components/landing/desktop-shortcuts.generated.ts'), '// Generated from desktop keyboard-shortcuts.ts by npm run demo:sync.\nexport const SHORTCUT_DEFS = '+JSON.stringify(shortcuts, null, 2)+' as const;\n');
console.log('Desktop demo theme synced');
