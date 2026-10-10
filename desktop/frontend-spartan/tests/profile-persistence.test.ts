import assert from 'node:assert/strict';
import test from 'node:test';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeAvatarValue } from '../src/features/profile/mascot-catalog.ts';
import type { UserProfileState } from '../src/features/profile/stores/user-profile-store.ts';
import { loadWithStubs } from './helpers/module-stubs.ts';

test('a committed mascot and its pending sync survive re-creating the profile store', () => {
  const values = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: globalThis.localStorage } });
  const load = () => loadWithStubs<{useUserProfileStore: UseBoundStore<StoreApi<UserProfileState>>}>(
    new URL('../src/features/profile/stores/user-profile-store.ts', import.meta.url),
    { zustand: { create }, 'zustand/middleware': { persist }, '../mascot-catalog': { normalizeAvatarValue } },
  ).useUserProfileStore;
  try {
    load().getState().setAvatarDataUrl('mascot:owl');
    const reopened = load();
    assert.equal(reopened.getState().avatarDataUrl, 'mascot:owl');
    assert.equal(reopened.getState().avatarSyncPending, true);
    reopened.setState({ avatarSyncPending: false });
    assert.equal(load().getState().avatarDataUrl, 'mascot:owl');
    assert.equal(load().getState().avatarSyncPending, false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
