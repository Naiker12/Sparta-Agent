/** Read-only build/dependency audit; writes only its JSON report in output/performance. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
async function files(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : entry.isFile() ? [path.join(directory, entry.name)] : []))).flat();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
async function inventory(directory) {
  const entries = await files(directory);
  const items = await Promise.all(entries.map(async file => ({ path: path.relative(root, file).replaceAll('\\', '/'), bytes: (await fs.stat(file)).size })));
  return { files: items.length, bytes: items.reduce((total, item) => total + item.bytes, 0), largest: items.sort((a, b) => b.bytes - a.bytes).slice(0, 15) };
}
const assets = await files(path.join(dist, 'assets'));
const chunks = await Promise.all(assets.filter(file => file.endsWith('.js')).map(async file => {
  const buffer = await fs.readFile(file);
  return { file: path.basename(file), bytes: buffer.length, gzipBytes: gzipSync(buffer).length };
}));
const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
const entry = html.match(/<script[^>]*src=["']([^"']+\.js)["']/)?.[1];
const visited = new Set();
async function staticClosure(file) {
  if (visited.has(file) || !file.startsWith(dist + path.sep)) return;
  visited.add(file);
  const source = await fs.readFile(file, 'utf8');
  const imports = [...source.matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.[^"']+\.js)["']/g)].map(match => path.resolve(path.dirname(file), match[1]));
  await Promise.all(imports.map(staticClosure));
}
if (entry) await staticClosure(path.resolve(dist, entry.replace(/^\//, '')));
const initial = chunks.filter(chunk => visited.has(path.join(dist, 'assets', chunk.file)));
const names = ['react', 'react-dom', 'vite', 'electron', 'motion', 'framer-motion', 'thinking-orbs', 'page-mascot', 'lucide-react', '@hugeicons/react', 'react-pdf', 'docx-preview', 'xlsx'];
const dependencies = [];
for (const context of ['.', 'desktop/frontend-spartan']) {
  const manifest = JSON.parse(await fs.readFile(path.join(root, context, 'package.json'), 'utf8'));
  const require = createRequire(path.join(root, context, 'package.json'));
  for (const name of names) {
    const declared = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
    if (!declared) continue;
    let installed = null;
    try {
      let directory = path.dirname(require.resolve(name));
      while (directory !== path.dirname(directory)) {
        try {
          const pkg = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
          if (pkg.name === name) { installed = pkg.version; break; }
        } catch { /* Walk towards the package root. */ }
        directory = path.dirname(directory);
      }
    } catch { /* Missing packages stay explicitly null. */ }
    dependencies.push({ context, name, declared, installed });
  }
}
const latest = {};
if (process.argv.includes('--check-updates')) {
  await Promise.all([...new Set(dependencies.map(item => item.name))].map(async name => {
    try {
      const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const pkg = await response.json();
      const version = pkg['dist-tags']?.latest;
      latest[name] = { version, publishedAt: pkg.time?.[version], repository: pkg.repository?.url };
    } catch { latest[name] = { unavailable: true }; }
  }));
}
const report = {
  measuredAt: new Date().toISOString(), scope: 'Static build/dependency inventory; not a CPU/RAM production benchmark',
  frontend: await inventory(dist), electronMainAndPreload: await inventory(path.join(root, 'dist-electron')),
  publicSource: await inventory(path.join(root, 'public')),
  initialStaticJavaScript: { note: 'Static imports only; ignores dynamic feature loads and runtime fetches', files: initial.map(chunk => chunk.file), bytes: initial.reduce((sum, chunk) => sum + chunk.bytes, 0), gzipBytes: initial.reduce((sum, chunk) => sum + chunk.gzipBytes, 0) },
  largestJavaScript: chunks.sort((a, b) => b.bytes - a.bytes).slice(0, 12), dependencies, latest,
};
const directory = path.join(root, 'output/performance');
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(path.join(directory, 'baseline.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ report: 'output/performance/baseline.json', frontendMiB: +(report.frontend.bytes / 1048576).toFixed(2), initialJavaScriptMiB: +(report.initialStaticJavaScript.bytes / 1048576).toFixed(2), largestJavaScript: report.largestJavaScript.slice(0, 5), dependencies, latest }, null, 2));
