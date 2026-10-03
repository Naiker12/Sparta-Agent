import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';

export async function validateUpdateMetadata(directory, document, version) {
  if (document.version !== version || !Array.isArray(document.files) || document.files.length === 0) {
    throw new Error('Update metadata does not match the release');
  }
  for (const file of document.files) {
    if (!file.url || path.basename(file.url) !== file.url || !file.sha512) throw new Error('Invalid update path');
    const filename = path.join(directory, file.url);
    const hash = createHash('sha512');
    for await (const chunk of createReadStream(filename)) hash.update(chunk);
    if (hash.digest('base64') !== file.sha512) throw new Error(`Update checksum mismatch: ${file.url}`);
    if (file.size !== undefined && (await fs.stat(filename)).size !== file.size) throw new Error(`Update size mismatch: ${file.url}`);
  }
}

export function mergeMacMetadata(documents, version) {
  const files = documents.flatMap(document => {
    if (document.version !== version || !Array.isArray(document.files)) {
      throw new Error('macOS update metadata does not match the release');
    }
    return document.files;
  });
  const urls = new Set();
  for (const file of files) {
    if (!file.url || !file.sha512 || urls.has(file.url) || path.basename(file.url) !== file.url) {
      throw new Error('Invalid or duplicate macOS update artifact');
    }
    urls.add(file.url);
  }
  const intel = files.find(file => file.url.endsWith('.zip') && file.url.includes('-x64-'));
  const arm = files.find(file => file.url.endsWith('.zip') && file.url.includes('-arm64-'));
  if (!intel || !arm) throw new Error('Both macOS architectures require an update ZIP');
  return { version, files, path: intel.url, sha512: intel.sha512, releaseDate: documents[0].releaseDate };
}

async function* artifactFiles(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* artifactFiles(filename);
    else if (entry.isFile()) yield filename;
  }
}

export async function prepareReleaseAssets(input, output, version) {
  await fs.mkdir(output, { recursive: true });
  const mac = [];
  const names = new Set();
  for (const directory of await fs.readdir(input, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const source = path.join(input, directory.name);
    for await (const file of artifactFiles(source)) {
      const name = path.basename(file);
      if (!/\.(exe|dmg|zip|AppImage|yml|blockmap)$/.test(name)) continue;
      if (name.endsWith('.yml') && !name.startsWith('latest')) continue;
      if (name === 'latest-mac.yml') {
        mac.push(yaml.load(await fs.readFile(file, 'utf8')));
        continue;
      }
      if (names.has(name)) throw new Error(`Duplicate release asset: ${name}`);
      names.add(name);
      await fs.copyFile(file, path.join(output, name));
    }
  }
  const metadata = mergeMacMetadata(mac, version);
  const required = [
    `Sparta-Agent-Windows-${version}-Setup.exe`, 'latest.yml',
    `Sparta-Agent-Mac-${version}-arm64-Installer.dmg`,
    `Sparta-Agent-Mac-${version}-x64-Installer.dmg`,
    `Sparta-Agent-Linux-${version}.AppImage`, 'latest-linux.yml',
    ...metadata.files.map(file => file.url),
  ];
  for (const name of required) {
    if (!names.has(name)) throw new Error(`Missing release asset: ${name}`);
  }
  for (const name of ['latest.yml', 'latest-linux.yml']) {
    await validateUpdateMetadata(output, yaml.load(await fs.readFile(path.join(output, name), 'utf8')), version);
  }
  await validateUpdateMetadata(output, metadata, version);
  await fs.writeFile(path.join(output, 'latest-mac.yml'), yaml.dump(metadata));
  console.log(`Validated ${names.size + 1} release assets for v${version}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [input, output, version] = process.argv.slice(2);
  if (!input || !output || !version) throw new Error('Usage: prepare-release-assets.mjs INPUT OUTPUT VERSION');
  await prepareReleaseAssets(input, output, version);
}
