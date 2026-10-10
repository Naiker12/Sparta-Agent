import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(readFileSync(path.join(root, name), 'utf8'));
const version = read('package.json').version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`Invalid product version: ${version}`);
for (const directory of ['', 'desktop/frontend-spartan', 'desktop/backend-spartan', 'desktop/ia-sparta-app-shell', 'desktop/ia-sparta-ipc-bridge', 'landing']) {
  const name = path.join(directory, 'package.json');
  if (read(name).version !== version) throw new Error(`Version mismatch: ${name}`);
}
for (const directory of ['', 'desktop/frontend-spartan', 'landing']) {
  const name = path.join(directory, 'package-lock.json');
  const lock = read(name);
  if (lock.version !== version || lock.packages[''].version !== version) throw new Error(`Version mismatch: ${name}`);
}
const requestedTag = process.argv[2];
if (requestedTag && requestedTag !== `v${version}`) throw new Error(`Tag ${requestedTag} does not match v${version}`);
readFileSync(path.join(root, `docs/releases/v${version}.md`), 'utf8');
console.log(`Product manifests, lockfiles and release notes match ${version}.`);
