/**
 * Settings blob store for website users who signed in with Google — the sync
 * path for people without Telegram. The blob lives in the bot's own database,
 * reached through the bot's /websync endpoint and authenticated by the `key` +
 * `sig` the Google sign-in obtained (lib/google/web-login.ts).
 *
 * This replaced the Google Drive store: a browser cannot keep a Google access
 * token alive without showing UI, so Drive sync popped a window on load. With
 * the bot holding the blob, sign-in is the only Google interaction and syncs
 * are plain authenticated POSTs.
 */

import { invalidateGoogleAccount, type GoogleAccount } from '@/lib/google/web-login';
import { botApiBase } from '@/lib/telegram/bot-sync';

import { deserializeSettingsBlob, PULL_FAILED, serializeSettingsBlob, type PullResult, type SettingsBlob } from './blob';

/**
 * One /websync round trip. Sending `rawBlob` stores it; omitting it reads.
 * Either way the response carries the stored blob. `ok` is false on any
 * network or HTTP failure so the caller degrades to "sync later".
 */
async function callWebSync(
  account: GoogleAccount,
  rawBlob?: string,
): Promise<{ ok: boolean; webPrefs: string | null }> {
  const base = botApiBase();
  if (!base) return { ok: false, webPrefs: null };
  const body: Record<string, unknown> = { key: account.key, sig: account.sig };
  if (rawBlob !== undefined) body.web_prefs = rawBlob;
  try {
    const res = await fetch(`${base}/websync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // 401 = the signature was rejected (e.g. after a token rotation); 404 = the
    // key is unknown (its row was reaped after the TTL). Either way the stored
    // credential is unusable, so drop it and let the panel re-prompt sign-in —
    // re-signing in returns the same key (and, for 404, re-creates the row), so
    // the data is intact. Other errors (500, network) are transient: treated as
    // "unreachable", credential kept.
    if (res.status === 401 || res.status === 404) invalidateGoogleAccount();
    if (!res.ok) return { ok: false, webPrefs: null };
    const data = (await res.json()) as { web_prefs?: unknown };
    return { ok: true, webPrefs: typeof data.web_prefs === 'string' ? data.web_prefs : null };
  } catch {
    return { ok: false, webPrefs: null };
  }
}

/**
 * Read the stored blob. `null` when the store is reachable but empty;
 * `PULL_FAILED` when the request failed — the engine must not push over a
 * store it couldn't read (this is the sole copy for Google users, so a
 * transient failure treated as "empty" would overwrite their settings).
 */
export async function pullFromGoogleWebSync(account: GoogleAccount): Promise<PullResult> {
  const { ok, webPrefs } = await callWebSync(account);
  if (!ok) return PULL_FAILED;
  if (!webPrefs) return null;
  try {
    return deserializeSettingsBlob(webPrefs);
  } catch {
    return null; // reached the store, but its content is unusable — safe to overwrite
  }
}

/** Store the blob. False when the write didn't happen. */
export async function pushToGoogleWebSync(account: GoogleAccount, blob: SettingsBlob): Promise<boolean> {
  const raw = serializeSettingsBlob(blob);
  if (raw === null) return false;
  const { ok } = await callWebSync(account, raw);
  return ok;
}

/**
 * Delete the account's stored settings from the bot (the "delete my data"
 * action), authenticated by the same key + sig. Returns whether the bot
 * confirmed. The caller signs out afterwards.
 */
export async function deleteGoogleWebSync(account: GoogleAccount): Promise<boolean> {
  const base = botApiBase();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/websync-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: account.key, sig: account.sig }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
