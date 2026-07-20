/**
 * Client for zmanim_bot's mini-app API — the two-way settings bridge when the
 * app runs inside Telegram (see docs/telegram-mini-app.md).
 *
 * Enabled by NEXT_PUBLIC_TG_BOT_API_URL (the bot API base, e.g.
 * https://bot.example/zmanim_bot/miniapp), inlined at build time like the
 * site's other public config. Every call authenticates with the launch's
 * signed initData; the bot validates it server-side, so there are no client
 * secrets. All failures degrade to null/false — the app works fine unsynced.
 */

/** A location as the bot stores it (name is the bot-side display label). */
export interface BotLocation {
  lat: number;
  lng: number;
  name: string;
  elevation?: number;
}

/** The user's bot-side profile: everything the mini app mirrors. */
export interface BotProfile {
  /** Bot UI language ('en' | 'he' | 'ru') or null if never chosen. */
  language: string | null;
  /** Candle-lighting minutes before sunset. */
  clOffset: number | null;
  /** One of the shared havdalah opinion keys (see lib/zmanim/havdalah.ts). */
  havdalaOpinion: string | null;
  /** The bot's active location, if any. */
  location: BotLocation | null;
  /** All locations saved in the bot (the active one included). */
  locations: BotLocation[];
  /**
   * The full settings blob (serialized, opaque to the bot — see
   * lib/sync/blob.ts) stored in the bot's Mongo, or null if never synced.
   */
  webPrefs: string | null;
}

/** The subset of the profile the mini app writes back. */
export interface BotSyncPatch {
  location?: BotLocation;
  clOffset?: number;
  havdalaOpinion?: string;
  /** Serialized settings blob to store verbatim. */
  webPrefs?: string;
}

/**
 * API credential: the Mini App's signed initData string, or — on the plain
 * website — the Telegram Login Widget payload (validated bot-side the same
 * stateless way). A bare string is initData, kept for the existing callers.
 */
export type BotAuth = string | { authData: Record<string, unknown> };

function authFields(auth: BotAuth): Record<string, unknown> {
  return typeof auth === 'string' ? { init_data: auth } : { auth_data: auth.authData };
}

const API_BASE = (process.env.NEXT_PUBLIC_TG_BOT_API_URL ?? '').replace(/\/+$/, '');

export function botSyncEnabled(): boolean {
  return API_BASE !== '';
}

function parseLocation(raw: unknown): BotLocation | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { lat, lng, name, elevation } = raw as Record<string, unknown>;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || typeof lng !== 'number' || !Number.isFinite(lng)) {
    return null;
  }
  return {
    lat,
    lng,
    name: typeof name === 'string' && name.trim() ? name : 'Selected location',
    elevation: typeof elevation === 'number' && Number.isFinite(elevation) ? elevation : undefined,
  };
}

function parseProfile(raw: unknown): BotProfile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;
  return {
    language: typeof data.language === 'string' ? data.language : null,
    clOffset: typeof data.cl_offset === 'number' && Number.isFinite(data.cl_offset) ? data.cl_offset : null,
    havdalaOpinion: typeof data.havdala_opinion === 'string' ? data.havdala_opinion : null,
    location: parseLocation(data.location),
    locations: Array.isArray(data.locations)
      ? data.locations.map(parseLocation).filter((loc): loc is BotLocation => loc !== null)
      : [],
    webPrefs: typeof data.web_prefs === 'string' && data.web_prefs ? data.web_prefs : null,
  };
}

async function call(path: string, body: Record<string, unknown>): Promise<BotProfile | null> {
  if (!botSyncEnabled()) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return parseProfile(await res.json());
  } catch {
    return null;
  }
}

/** Fetch the bot-side profile. Null = disabled, unauthenticated, or unreachable. */
export function fetchBotProfile(auth: BotAuth): Promise<BotProfile | null> {
  return call('/me', authFields(auth));
}

/**
 * Send an export file to the user's bot chat (the Telegram webview can't do
 * browser downloads). Multipart keeps the request preflight-free. Returns
 * whether the bot confirmed delivery.
 */
export async function sendExportToBot(initData: string, blob: Blob, filename: string): Promise<boolean> {
  if (!botSyncEnabled()) return false;
  try {
    const form = new FormData();
    form.append('init_data', initData);
    form.append('file', blob, filename);
    const res = await fetch(`${API_BASE}/export`, { method: 'POST', body: form });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Push mini-app changes back to the bot. Returns the updated profile, or null
 * when the sync didn't happen (the caller keeps its dirty state and retries on
 * the next change).
 */
export function pushBotSync(auth: BotAuth, patch: BotSyncPatch): Promise<BotProfile | null> {
  const body: Record<string, unknown> = authFields(auth);
  if (patch.location) {
    body.location = {
      lat: patch.location.lat,
      lng: patch.location.lng,
      name: patch.location.name,
      elevation: patch.location.elevation != null ? Math.max(0, Math.round(patch.location.elevation)) : undefined,
    };
  }
  if (patch.clOffset !== undefined) body.cl_offset = patch.clOffset;
  if (patch.havdalaOpinion !== undefined) body.havdala_opinion = patch.havdalaOpinion;
  if (patch.webPrefs !== undefined) body.web_prefs = patch.webPrefs;
  return call('/sync', body);
}
