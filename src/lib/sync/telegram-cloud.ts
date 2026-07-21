/**
 * Settings blob in Telegram CloudStorage — Telegram's own per-user key-value
 * store (Bot API 6.9+), so Mini App users sync across devices with zero
 * backend involved. Values are capped at 4096 chars, so the serialized blob
 * is split into chunks under a small meta record:
 *
 *   settings-meta        {v:1, chunks:n, updatedAt}
 *   settings-0 … settings-(n-1)
 *
 * Chunks are written first and the meta last, so a torn write leaves the
 * previous consistent snapshot readable (reads never look past meta.chunks).
 */

import type { TelegramCloudStorage, TelegramWebApp } from '@/lib/telegram/mini-app';

import { deserializeSettingsBlob, SECTION_NAMES, serializeSettingsBlob, type SettingsBlob } from './blob';

/** The newest section stamp — cosmetic bookkeeping for the chunk meta. */
function newestStamp(blob: SettingsBlob): string {
  return SECTION_NAMES.map((name) => blob.sections[name].t).sort().at(-1) ?? new Date(0).toISOString();
}

const META_KEY = 'settings-meta';
const CHUNK_KEY_PREFIX = 'settings-';
/** Under the 4096-char value cap with margin for any encoding overhead. */
export const CLOUD_CHUNK_CHARS = 3900;

/** CloudStorage needs Bot API 6.9+ and the SDK object actually exposing it. */
export function cloudStorageAvailable(webApp: TelegramWebApp | null): boolean {
  try {
    return Boolean(webApp?.CloudStorage) && webApp!.isVersionAtLeast('6.9');
  } catch {
    return false;
  }
}

export function splitIntoChunks(raw: string, size: number = CLOUD_CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < raw.length; i += size) chunks.push(raw.slice(i, i + size));
  return chunks.length > 0 ? chunks : [''];
}

function getItem(storage: TelegramCloudStorage, key: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      storage.getItem(key, (error, value) => resolve(error ? null : (value ?? null)));
    } catch {
      resolve(null);
    }
  });
}

function getItems(storage: TelegramCloudStorage, keys: string[]): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    try {
      storage.getItems(keys, (error, values) => resolve(error ? null : (values ?? null)));
    } catch {
      resolve(null);
    }
  });
}

function setItem(storage: TelegramCloudStorage, key: string, value: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      storage.setItem(key, value, (error, stored) => resolve(!error && stored !== false));
    } catch {
      resolve(false);
    }
  });
}

function removeItems(storage: TelegramCloudStorage, keys: string[]): Promise<void> {
  return new Promise((resolve) => {
    try {
      storage.removeItems(keys, () => resolve());
    } catch {
      resolve();
    }
  });
}

interface CloudMeta {
  v: 1;
  chunks: number;
  updatedAt: string;
}

function parseMeta(raw: string | null): CloudMeta | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    const meta = data as Record<string, unknown>;
    if (meta.v !== 1 || typeof meta.chunks !== 'number' || typeof meta.updatedAt !== 'string') return null;
    // A blob within MAX_BLOB_CHARS never needs more than ~17 chunks.
    if (!Number.isInteger(meta.chunks) || meta.chunks < 1 || meta.chunks > 64) return null;
    return { v: 1, chunks: meta.chunks, updatedAt: meta.updatedAt };
  } catch {
    return null;
  }
}

/** Read the stored blob; null when absent, torn, or CloudStorage errors out. */
export async function pullFromTelegramCloud(webApp: TelegramWebApp | null): Promise<SettingsBlob | null> {
  if (!cloudStorageAvailable(webApp)) return null;
  const storage = webApp!.CloudStorage!;
  const meta = parseMeta(await getItem(storage, META_KEY));
  if (!meta) return null;
  const keys = Array.from({ length: meta.chunks }, (_, i) => `${CHUNK_KEY_PREFIX}${i}`);
  const values = await getItems(storage, keys);
  if (!values) return null;
  let raw = '';
  for (const key of keys) {
    const part = values[key];
    if (typeof part !== 'string') return null; // torn snapshot — ignore it
    raw += part;
  }
  return deserializeSettingsBlob(raw);
}

/** Write the blob (chunks first, meta last). False when any write fails. */
export async function pushToTelegramCloud(webApp: TelegramWebApp | null, blob: SettingsBlob): Promise<boolean> {
  if (!cloudStorageAvailable(webApp)) return false;
  const storage = webApp!.CloudStorage!;
  const raw = serializeSettingsBlob(blob);
  if (raw === null) return false;

  const previous = parseMeta(await getItem(storage, META_KEY));
  const chunks = splitIntoChunks(raw);
  for (let i = 0; i < chunks.length; i += 1) {
    if (!(await setItem(storage, `${CHUNK_KEY_PREFIX}${i}`, chunks[i]))) return false;
  }
  const meta: CloudMeta = { v: 1, chunks: chunks.length, updatedAt: newestStamp(blob) };
  if (!(await setItem(storage, META_KEY, JSON.stringify(meta)))) return false;

  // Best-effort cleanup of chunks a shorter snapshot no longer uses.
  if (previous && previous.chunks > chunks.length) {
    const stale = Array.from(
      { length: previous.chunks - chunks.length },
      (_, i) => `${CHUNK_KEY_PREFIX}${chunks.length + i}`,
    );
    await removeItems(storage, stale);
  }
  return true;
}
