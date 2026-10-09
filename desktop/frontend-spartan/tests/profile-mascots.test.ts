import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, statSync } from 'node:fs';
import { MASCOT_CHARACTERS, mascotCharacter, mascotValue, normalizeAvatarValue, isProfilePhoto, profileAssetUrl } from '../src/features/profile/mascot-catalog.ts';

test('desktop assets resolve beside index.html while web assets survive deep routes', () => {
  assert.equal(profileAssetUrl('mascots/cat-directions.webp', './', 'file:///D:/Sparta/resources/app/dist/index.html#/settings'), 'file:///D:/Sparta/resources/app/dist/mascots/cat-directions.webp');
  assert.equal(profileAssetUrl('mascots/cat-directions.webp', '/', 'file:///D:/Sparta/resources/app/dist/index.html'), 'file:///D:/Sparta/resources/app/dist/mascots/cat-directions.webp');
  assert.equal(profileAssetUrl('mascots/cat-directions.webp', '/', 'http://localhost:5187/settings/profile'), 'http://localhost:5187/mascots/cat-directions.webp');
  assert.equal(profileAssetUrl('mascots/cat-directions.webp', '/sparta/', 'https://example.com/sparta/settings'), 'https://example.com/sparta/mascots/cat-directions.webp');
});

test('every selectable mascot has both bundled sprite sheets', () => {
  assert.equal(new Set(MASCOT_CHARACTERS).size, MASCOT_CHARACTERS.length);
  const provenance = JSON.parse(readFileSync(new URL('../src/assets/mascots/provenance.json', import.meta.url), 'utf8'));
  for (const character of MASCOT_CHARACTERS) {
    for (const kind of ['directions', 'reactions']) {
      const file = `${character}-${kind}.webp`;
      const asset = new URL(`../src/assets/mascots/${file}`, import.meta.url);
      assert.equal(statSync(asset).size, provenance.files.find((item: {file:string}) => item.file === file).bytes);
      const signature = readFileSync(asset).subarray(0, 12).toString('ascii');
      assert.equal(signature.slice(0, 4), 'RIFF');
      assert.equal(signature.slice(8), 'WEBP');
    }
    assert.equal(mascotCharacter(mascotValue(character)), character);
  }
});

test('migration keeps old generated selections stable and preserves uploaded photos', () => {
  const migrated = normalizeAvatarValue('blobatar:sparta-avatar-03');
  assert.equal(migrated, normalizeAvatarValue('blobatar:sparta-avatar-03'));
  assert.ok(migrated?.startsWith('mascot:'));
  assert.equal(normalizeAvatarValue(migrated), migrated);
  assert.equal(normalizeAvatarValue('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  assert.equal(normalizeAvatarValue('/Sloth%20emojis/large%20sloth%20yay.png'), '/Sloth%20emojis/large%20sloth%20yay.png');
  assert.equal(normalizeAvatarValue(null), null);
  assert.equal(isProfilePhoto(migrated), false);
  assert.equal(isProfilePhoto('data:image/png;base64,AAAA'), true);
});

test('unknown or unsafe character tokens fall back to a bundled mascot', () => {
  for (const value of [null, 'mascot:missing', 'mascot:../../secret', 'mascot:https://evil.example/image']) {
    assert.equal(mascotCharacter(value), 'fox');
  }
});
