/**
 * Settings blob in the user's own Google Drive appDataFolder — the sync path
 * for people without Telegram. Pure client-side: Google Identity Services
 * issues short-lived access tokens against a public OAuth client id (no
 * secret, no backend), and the blob lives as one JSON file in the hidden
 * app-data space of the user's Drive (the non-sensitive `drive.appdata`
 * scope). Enabled by NEXT_PUBLIC_GOOGLE_CLIENT_ID, inlined at build time.
 *
 * Token lifecycle: GIS gives ~1h tokens and no refresh token in the browser.
 * A connect (user gesture) gets the first token interactively; later syncs
 * retry silently — when Google wants interaction again (session expired,
 * popup blocked), the sync quietly skips and the Sync & backup tool offers a
 * "sync now" button whose gesture is allowed to open the popup.
 */

import { deserializeSettingsBlob, serializeSettingsBlob, type SettingsBlob } from './blob';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'zmanim-settings.json';
const GSI_SRC = 'https://accounts.google.com/gsi/client';
/** Remembers that the user connected Drive sync on this device. */
const CONNECTED_KEY = 'zmanim:google-sync:v1';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (config?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: unknown) => void;
          }) => TokenClient;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

export function googleSyncConfigured(): boolean {
  return CLIENT_ID !== '';
}

export function googleSyncConnected(): boolean {
  if (!googleSyncConfigured()) return false;
  try {
    return window.localStorage.getItem(CONNECTED_KEY) === '1';
  } catch {
    return false;
  }
}

let gsiPromise: Promise<boolean> | null = null;

/** Inject the GIS script once; false when it can't load (offline, blocked). */
function loadGsi(): Promise<boolean> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(true);
  gsiPromise ??= new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.google?.accounts?.oauth2));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return gsiPromise;
}

let cachedToken: { token: string; expiresAt: number } | null = null;
/** One token request at a time — GIS token clients are not reentrant. */
let tokenRequest: Promise<string | null> | null = null;

function requestToken(interactive: boolean): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return Promise.resolve(cachedToken.token);
  }
  tokenRequest ??= new Promise<string | null>((resolve) => {
    void loadGsi().then((loaded) => {
      const oauth2 = loaded ? window.google?.accounts?.oauth2 : undefined;
      if (!oauth2) {
        resolve(null);
        return;
      }
      try {
        const client = oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: (response) => {
            if (response.access_token) {
              cachedToken = {
                token: response.access_token,
                expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
              };
              resolve(response.access_token);
            } else {
              resolve(null);
            }
          },
          // Popup blocked / closed / consent needed — resolve null, the
          // caller degrades to "sync later".
          error_callback: () => resolve(null),
        });
        client.requestAccessToken(interactive ? undefined : { prompt: '' });
      } catch {
        resolve(null);
      }
    });
  }).finally(() => {
    tokenRequest = null;
  });
  return tokenRequest;
}

/**
 * Interactive first grant (must run in a user gesture). Marks the device
 * connected on success.
 */
export async function connectGoogleDrive(): Promise<boolean> {
  if (!googleSyncConfigured()) return false;
  const token = await requestToken(true);
  if (!token) return false;
  try {
    window.localStorage.setItem(CONNECTED_KEY, '1');
  } catch {
    // The grant still works for this session.
  }
  return true;
}

/** Forget the connection and best-effort revoke the current token. */
export function disconnectGoogleDrive(): void {
  try {
    window.localStorage.removeItem(CONNECTED_KEY);
  } catch {
    // Nothing to clean up.
  }
  const token = cachedToken?.token;
  cachedToken = null;
  if (token) {
    try {
      window.google?.accounts?.oauth2?.revoke(token);
    } catch {
      // Revocation is best-effort; the token expires within the hour anyway.
    }
  }
}

async function driveFetch(token: string, url: string, init?: RequestInit): Promise<Response | null> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) {
      cachedToken = null; // token revoked server-side — force a re-request next time
      return null;
    }
    return response;
  } catch {
    return null;
  }
}

async function findFileId(token: string): Promise<string | null | undefined> {
  const query = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${FILE_NAME}'`,
    fields: 'files(id)',
    pageSize: '1',
  });
  const response = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?${query}`);
  if (!response?.ok) return undefined; // request failed — unknown, don't create a duplicate
  try {
    const data = (await response.json()) as { files?: { id?: string }[] };
    const id = data.files?.[0]?.id;
    return typeof id === 'string' ? id : null; // null = definitively absent
  } catch {
    return undefined;
  }
}

/** Read the stored blob; null when disconnected, absent, or unreachable. */
export async function pullFromGoogleDrive(interactive = false): Promise<SettingsBlob | null> {
  if (!googleSyncConnected()) return null;
  const token = await requestToken(interactive);
  if (!token) return null;
  const fileId = await findFileId(token);
  if (!fileId) return null;
  const response = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  if (!response?.ok) return null;
  try {
    return deserializeSettingsBlob(await response.text());
  } catch {
    return null;
  }
}

/** Create or update the blob file. False when the write didn't happen. */
export async function pushToGoogleDrive(blob: SettingsBlob, interactive = false): Promise<boolean> {
  if (!googleSyncConnected()) return false;
  const raw = serializeSettingsBlob(blob);
  if (raw === null) return false;
  const token = await requestToken(interactive);
  if (!token) return false;

  const fileId = await findFileId(token);
  if (fileId === undefined) return false;

  if (fileId) {
    const response = await driveFetch(
      token,
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: raw },
    );
    return Boolean(response?.ok);
  }

  // First write: multipart create with the appDataFolder parent.
  const boundary = 'zmanim-settings-blob';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] }),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    raw,
    `--${boundary}--`,
    '',
  ].join('\r\n');
  const response = await driveFetch(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return Boolean(response?.ok);
}
