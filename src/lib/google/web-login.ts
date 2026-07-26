/**
 * "Sign in with Google" on the website — the account path for people without
 * Telegram, mirroring lib/telegram/web-login.ts.
 *
 * Identity only, via Google Identity Services' **ID-token** flow (not the
 * access-token flow the Drive version used). The button hands back a signed
 * JWT; it goes once to the bot's /google-key, which verifies it and returns an
 * opaque sync `key` plus a `sig` that authenticates it. From then on the site
 * syncs settings through the bot's /websync using that key + sig and **never
 * contacts Google again** — no access tokens, no Drive, no popup on load.
 *
 * Why this shape: a browser is never issued a refresh token, and minting a
 * Google access token always shows UI, so any design that needs a token on
 * page load makes a daily visitor face a popup every visit. Moving the store
 * to the bot removes the need for a token after sign-in entirely. See
 * docs/settings-sync.md.
 *
 * Enabled only when BOTH NEXT_PUBLIC_GOOGLE_CLIENT_ID and the bot API base are
 * set — the bot is where the data goes, so Google login is useless without it.
 */

import { clearLineage } from '@/lib/sync/blob';
import { botApiBase } from '@/lib/telegram/bot-sync';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const GSI_SRC = 'https://accounts.google.com/gsi/client';
/** Holds the sync credential (key + sig) and the display profile. */
const ACCOUNT_KEY = 'zmanim:google-account:v2';
/** Orphaned keys from the old Drive flow — cleared on sign-out for hygiene. */
const LEGACY_KEYS = [
  'zmanim:google-account:v1',
  'zmanim:google-sync:v1',
  'zmanim:google-token:v1',
  'zmanim:google-silent-denied:v1',
];

/** Fired after sign-in / sign-out so listeners (e.g. the sync engine) react. */
export const GOOGLE_AUTH_EVENT = 'zmanim:google-auth';

/**
 * What we hold for a signed-in account. `key`/`sig` are the bot sync
 * credential (see the bot's /websync); the rest is display-only, kept on this
 * device and never sent anywhere but the account panel.
 */
export interface GoogleAccount {
  key: string;
  sig: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface CredentialResponse {
  credential?: string;
}

interface GoogleIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
  disableAutoSelect: () => void;
}

/** The app's current locale, so Google's button matches the page language. */
function currentLocale(): string {
  return typeof document !== 'undefined' && document.documentElement.lang ? document.documentElement.lang : 'en';
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

/** Configured only when both the Google client id and the bot store exist. */
export function googleLoginConfigured(): boolean {
  return CLIENT_ID !== '' && botApiBase() !== '';
}

/**
 * The account held for this page when localStorage can't persist it (blocked
 * or full). Without this a sign-in whose write failed would report success in
 * the UI while `loadGoogleAccount` read back null and the sync engine found no
 * account — a connection that looks live but does nothing, even this session.
 */
let memoryAccount: GoogleAccount | null = null;

function isGoogleAccount(data: unknown): data is GoogleAccount {
  if (typeof data !== 'object' || data === null) return false;
  const account = data as GoogleAccount;
  return typeof account.key === 'string' && typeof account.sig === 'string';
}

/** The signed-in account, or null. */
export function loadGoogleAccount(): GoogleAccount | null {
  if (!googleLoginConfigured()) return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(ACCOUNT_KEY);
  } catch {
    // localStorage unavailable — the in-memory copy is all we have (e.g. a
    // sign-in whose persist write also failed).
    return memoryAccount;
  }
  // localStorage is readable: it is authoritative. An absent key means signed
  // out — including a sign-out in another tab — so do NOT fall back to a stale
  // in-memory account, or this tab would keep syncing after that sign-out.
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    return isGoogleAccount(data) ? data : null;
  } catch {
    return null; // corrupt
  }
}

export function googleSignedIn(): boolean {
  return loadGoogleAccount() !== null;
}

/** A short display name for the "signed in as" line; '' when unknown. */
export function googleAccountDisplayName(account: GoogleAccount): string {
  return account.name || account.email || '';
}

function saveGoogleAccount(account: GoogleAccount): void {
  // Keep it in memory regardless, so a sign-in works for this session even if
  // the persistent write fails (it just won't survive a reload then).
  memoryAccount = account;
  try {
    window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  } catch {
    // Memory-only for this session.
  }
  window.dispatchEvent(new Event(GOOGLE_AUTH_EVENT));
}

let gsiPromise: Promise<boolean> | null = null;

/** Inject the GIS script once; false when it can't load (offline, blocked). */
function loadGsi(): Promise<boolean> {
  if (window.google?.accounts?.id) return Promise.resolve(true);
  gsiPromise ??= new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.google?.accounts?.id));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return gsiPromise;
}

/**
 * Exchange a Google ID token for the bot sync credential, store it, and return
 * the account. Null when the bot rejects the token or is unreachable.
 */
async function exchangeGoogleCredential(credential: string): Promise<GoogleAccount | null> {
  const base = botApiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/google-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (typeof data.key !== 'string' || typeof data.sig !== 'string') return null;
    const text = (k: string): string | undefined => (typeof data[k] === 'string' ? (data[k] as string) : undefined);
    const account: GoogleAccount = {
      key: data.key,
      sig: data.sig,
      email: text('email'),
      name: text('name'),
      picture: text('picture'),
    };
    saveGoogleAccount(account);
    return account;
  } catch {
    return null;
  }
}

/**
 * Render Google's official Sign-in button into `container`. After the user
 * picks an account, `onResult` fires with the signed-in account, or `null`
 * when the exchange with the bot failed (so the caller can surface an error).
 * It does NOT fire if the user dismisses the chooser. Returns a cleanup that
 * removes the button. This is the only place a Google UI ever shows.
 */
export function mountGoogleSignInButton(
  container: HTMLElement,
  onResult: (account: GoogleAccount | null) => void,
): () => void {
  let cancelled = false;
  void loadGsi().then((ok) => {
    const id = ok ? window.google?.accounts?.id : undefined;
    if (!id || cancelled) return;
    id.initialize({
      client_id: CLIENT_ID,
      auto_select: false,
      callback: (response) => {
        // No credential = the user dismissed the chooser; stay silent. Once a
        // credential arrives, always report the outcome — `null` when the
        // exchange with the bot failed — so the caller can show an error
        // instead of the sign-in looking like it silently did nothing.
        if (!response.credential) return;
        void exchangeGoogleCredential(response.credential).then((account) => {
          if (!cancelled) onResult(account);
        });
      },
    });
    id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      locale: currentLocale(),
    });
  });
  return () => {
    cancelled = true;
    container.replaceChildren();
  };
}

/**
 * Drop the stored credential after the bot rejects it (a 401 from /websync —
 * e.g. a bot-token rotation invalidated the signature). Not a user gesture, so
 * unlike signOutFromGoogle it leaves GIS auto-select alone; the account panel
 * just shows "Sign in with Google" again, and re-signing in returns the same
 * key with a fresh signature, so the settings are intact.
 */
export function invalidateGoogleAccount(): void {
  memoryAccount = null;
  try {
    window.localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    // Nothing to clean up.
  }
  clearLineage('google-websync');
  window.dispatchEvent(new Event(GOOGLE_AUTH_EVENT));
}

/** Sign out of this device: drop the credential and stop auto-select. */
export function signOutFromGoogle(): void {
  memoryAccount = null;
  try {
    window.localStorage.removeItem(ACCOUNT_KEY);
    for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
  } catch {
    // Nothing to clean up.
  }
  // Signing out ends this account's sync lineage: the next sign-in — even to
  // the same account — is a fresh connect and must reconcile before pushing.
  clearLineage('google-websync');
  try {
    window.google?.accounts?.id?.disableAutoSelect();
  } catch {
    // GIS not loaded — nothing to disable.
  }
  window.dispatchEvent(new Event(GOOGLE_AUTH_EVENT));
}
