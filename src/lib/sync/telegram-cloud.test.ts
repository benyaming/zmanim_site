import { describe, expect, it } from 'vitest';

import type { TelegramCloudStorage, TelegramWebApp } from '@/lib/telegram/mini-app';

import { PULL_FAILED, type SettingsBlob } from './blob';
import {
  CLOUD_CHUNK_CHARS,
  cloudStorageAvailable,
  pullFromTelegramCloud,
  pushToTelegramCloud,
  splitIntoChunks,
} from './telegram-cloud';

/** In-memory CloudStorage with Telegram's error-first callback shape. */
function fakeStorage(store: Map<string, string>): TelegramCloudStorage {
  return {
    setItem: (key, value, callback) => {
      store.set(key, value);
      callback?.(null, true);
    },
    getItem: (key, callback) => callback(null, store.get(key)),
    getItems: (keys, callback) =>
      callback(null, Object.fromEntries(keys.filter((k) => store.has(k)).map((k) => [k, store.get(k)!]))),
    removeItems: (keys, callback) => {
      keys.forEach((k) => store.delete(k));
      callback?.(null, true);
    },
  };
}

function fakeWebApp(store: Map<string, string>, version = '8.0'): TelegramWebApp {
  return {
    initData: '',
    version,
    platform: 'ios',
    ready: () => {},
    expand: () => {},
    isVersionAtLeast: (v) => Number.parseFloat(version) >= Number.parseFloat(v),
    CloudStorage: fakeStorage(store),
  };
}

function blobWithPrefs(prefs: Record<string, unknown>, t = '2026-07-19T10:00:00.000Z'): SettingsBlob {
  return {
    v: 2,
    sections: {
      prefs: { data: prefs, t },
      a11y: { data: null, t },
      theme: { data: null, t },
      language: { data: null, t },
    },
  };
}

describe('cloudStorageAvailable', () => {
  it('needs both the object and Bot API 6.9', () => {
    const store = new Map<string, string>();
    expect(cloudStorageAvailable(fakeWebApp(store))).toBe(true);
    expect(cloudStorageAvailable(fakeWebApp(store, '6.2'))).toBe(false);
    expect(cloudStorageAvailable({ ...fakeWebApp(store), CloudStorage: undefined })).toBe(false);
    expect(cloudStorageAvailable(null)).toBe(false);
  });
});

describe('splitIntoChunks', () => {
  it('splits at the chunk size and always yields at least one chunk', () => {
    expect(splitIntoChunks('', 4)).toEqual(['']);
    expect(splitIntoChunks('abcdefgh', 3)).toEqual(['abc', 'def', 'gh']);
    const big = 'x'.repeat(CLOUD_CHUNK_CHARS * 2 + 5);
    const chunks = splitIntoChunks(big);
    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.length <= CLOUD_CHUNK_CHARS)).toBe(true);
    expect(chunks.join('')).toBe(big);
  });
});

describe('push / pull roundtrip', () => {
  it('stores and restores a small blob', async () => {
    const store = new Map<string, string>();
    const webApp = fakeWebApp(store);
    const blob = blobWithPrefs({ candleLightingOffset: 30 });
    expect(await pushToTelegramCloud(webApp, blob)).toBe(true);
    expect(await pullFromTelegramCloud(webApp)).toEqual(blob);
  });

  it('chunks a large blob across values and cleans up stale chunks on shrink', async () => {
    const store = new Map<string, string>();
    const webApp = fakeWebApp(store);
    const big = blobWithPrefs({ note: 'y'.repeat(CLOUD_CHUNK_CHARS * 2) });
    expect(await pushToTelegramCloud(webApp, big)).toBe(true);
    expect(store.size).toBeGreaterThan(2); // meta + several chunks
    expect(await pullFromTelegramCloud(webApp)).toEqual(big);

    const small = blobWithPrefs({ note: 'small' }, '2026-07-19T11:00:00.000Z');
    expect(await pushToTelegramCloud(webApp, small)).toBe(true);
    expect(await pullFromTelegramCloud(webApp)).toEqual(small);
    expect(store.size).toBe(2); // meta + one chunk — stale chunks removed
  });

  it('returns null on an empty store and on a torn snapshot', async () => {
    const store = new Map<string, string>();
    const webApp = fakeWebApp(store);
    expect(await pullFromTelegramCloud(webApp)).toBeNull();

    await pushToTelegramCloud(webApp, blobWithPrefs({ note: 'z'.repeat(CLOUD_CHUNK_CHARS + 1) }));
    store.delete('settings-1'); // lose a chunk
    expect(await pullFromTelegramCloud(webApp)).toBeNull();
  });

  it('reports PULL_FAILED on an SDK read error — never "empty"', async () => {
    // A transient CloudStorage failure must not read as a confirmed empty
    // store: the reconcile would record lineage and seed (overwrite) a store
    // that actually holds the account's only snapshot.
    const store = new Map<string, string>();
    const webApp = fakeWebApp(store);
    await pushToTelegramCloud(webApp, blobWithPrefs({ note: 'kept' }));

    const failingMeta = { ...fakeWebApp(store), CloudStorage: { ...fakeStorage(store), getItem: (_k, cb) => cb('INTERNAL_ERROR') } as TelegramCloudStorage };
    expect(await pullFromTelegramCloud(failingMeta)).toBe(PULL_FAILED);

    const failingChunks = { ...fakeWebApp(store), CloudStorage: { ...fakeStorage(store), getItems: (_k, cb) => cb('INTERNAL_ERROR') } as TelegramCloudStorage };
    expect(await pullFromTelegramCloud(failingChunks)).toBe(PULL_FAILED);
  });
});
