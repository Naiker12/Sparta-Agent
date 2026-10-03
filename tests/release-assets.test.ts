import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
// @ts-expect-error JavaScript release tooling intentionally has no declaration file.
import { mergeMacMetadata, validateUpdateMetadata } from '../scripts/prepare-release-assets.mjs';

const metadata = (arch: string, version = '0.3.3') => ({
  version,
  files: [{ url: `Sparta-Agent-Mac-${version}-${arch}-Installer.zip`, sha512: `digest-${arch}`, size: 100 }],
  releaseDate: '2026-10-02T00:00:00.000Z',
});

describe('macOS release metadata', () => {
  it('preserves both architectures and uses Intel for legacy update fields', () => {
    const result = mergeMacMetadata([metadata('arm64'), metadata('x64')], '0.3.3');
    expect(result.files).toHaveLength(2);
    expect(result.path).toContain('-x64-');
    expect(result.sha512).toBe('digest-x64');
  });
  it('rejects incomplete architectures, duplicate URLs and different versions', () => {
    expect(() => mergeMacMetadata([metadata('arm64')], '0.3.3')).toThrow('Both');
    expect(() => mergeMacMetadata([metadata('x64'), metadata('x64')], '0.3.3')).toThrow('duplicate');
    expect(() => mergeMacMetadata([metadata('arm64'), metadata('x64', '0.3.2')], '0.3.3')).toThrow('match');
  });
  it('checks the actual download bytes against updater hashes and sizes', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sparta-release-test-'));
    try {
      const bytes = Buffer.from('installer fixture');
      await fs.writeFile(path.join(directory, 'installer.zip'), bytes);
      const document = { version: '0.3.3', files: [{ url: 'installer.zip', sha512: createHash('sha512').update(bytes).digest('base64'), size: bytes.length }] };
      await expect(validateUpdateMetadata(directory, document, '0.3.3')).resolves.toBeUndefined();
      await fs.writeFile(path.join(directory, 'installer.zip'), 'modified');
      await expect(validateUpdateMetadata(directory, document, '0.3.3')).rejects.toThrow('checksum');
    } finally {
      if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('sparta-release-test-')) throw new Error('Unexpected temporary path');
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
