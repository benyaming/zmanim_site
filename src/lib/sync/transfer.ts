/**
 * Account-free settings transfer: the blob rides in a URL fragment (copy a
 * link, open it on the other device) or in a downloadable JSON file. The
 * fragment never reaches any server, so this path keeps the data entirely
 * user-held.
 */

import { collectSettingsBlob, deserializeSettingsBlob, type SettingsBlob } from './blob';

/** Fragment parameter carrying an encoded blob: `#settings=<base64url>`. */
export const SETTINGS_HASH_PARAM = 'settings';

export const SETTINGS_FILE_NAME = 'zmanim-settings.json';

/** UTF-8 → base64url without the call-stack limits of a spread over bytes. */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string | null {
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Encode a blob for the link fragment. Null when it exceeds the size cap. */
export function encodeSettingsPayload(blob: SettingsBlob): string | null {
  const raw = JSON.stringify(blob);
  return raw.length <= 65536 ? toBase64Url(raw) : null;
}

export function decodeSettingsPayload(payload: string): SettingsBlob | null {
  const raw = fromBase64Url(payload);
  return raw === null ? null : deserializeSettingsBlob(raw);
}

/** A shareable link that applies this device's settings when opened. */
export function buildSettingsLink(): string | null {
  const payload = encodeSettingsPayload(collectSettingsBlob());
  if (!payload) return null;
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${SETTINGS_HASH_PARAM}=${payload}`;
}

/**
 * The blob carried by a URL fragment, or null when the fragment isn't a
 * settings link (e.g. it's a Telegram launch fragment, or plain navigation).
 */
export function settingsFromHash(hash: string): SettingsBlob | null {
  const payload = new URLSearchParams(hash.replace(/^#/, '')).get(SETTINGS_HASH_PARAM);
  return payload ? decodeSettingsPayload(payload) : null;
}

/** The blob as a pretty-printed JSON file for download. */
export function settingsFileBlob(): Blob {
  return new Blob([JSON.stringify(collectSettingsBlob(), null, 2)], { type: 'application/json' });
}

export function parseSettingsFile(text: string): SettingsBlob | null {
  return deserializeSettingsBlob(text.trim());
}
