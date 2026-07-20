/**
 * Telegram Mini App environment: detection, SDK loading, launch setup.
 * (See docs/telegram-mini-app.md for the full integration picture.)
 *
 * Telegram launches a mini app with its parameters in the URL fragment
 * (tgWebAppData, tgWebAppPlatform, …). The fragment is captured once at module
 * load — before the app-state URL-reflect effect rewrites the URL and drops
 * it — and remembered in sessionStorage so in-webview reloads (which can lose
 * the fragment) still count as Telegram and keep their initData.
 */

/**
 * Telegram's per-user key-value store (Bot API 6.9+). Callback-style API;
 * values are capped at 4096 chars, keys at 128 ([A-Za-z0-9_-]).
 */
export interface TelegramCloudStorage {
  setItem: (key: string, value: string, callback?: (error: string | null, stored?: boolean) => void) => void;
  getItem: (key: string, callback: (error: string | null, value?: string) => void) => void;
  getItems: (keys: string[], callback: (error: string | null, values?: Record<string, string>) => void) => void;
  removeItems: (keys: string[], callback?: (error: string | null, removed?: boolean) => void) => void;
}

/** The subset of the telegram-web-app.js SDK surface this app uses. */
export interface TelegramWebApp {
  /** Raw signed launch data — the API's stateless auth credential. */
  initData: string;
  version: string;
  platform: string;
  ready: () => void;
  expand: () => void;
  isVersionAtLeast: (version: string) => boolean;
  /** Bot API 7.7+; keeps vertical swipes on the calendar from minimizing the app. */
  disableVerticalSwipes?: () => void;
  /** Bot API 6.9+; per-user Telegram-hosted key-value storage. */
  CloudStorage?: TelegramCloudStorage;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
    /** Injected by Telegram's native (mobile/desktop) webviews. */
    TelegramWebviewProxy?: unknown;
  }
}

const FLAG_KEY = 'zmanim:tg-mini-app';
const INIT_DATA_KEY = 'zmanim:tg-init-data';
const SDK_SRC = 'https://telegram.org/js/telegram-web-app.js';

/** The launch fragment, captured before anything can rewrite the URL. */
const launchHash = typeof window !== 'undefined' ? window.location.hash : '';

function launchParam(name: string): string | null {
  return new URLSearchParams(launchHash.replace(/^#/, '')).get(name);
}

/** Whether this page runs inside Telegram. Stable per session; false during SSR. */
export function isTelegramMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (launchHash.includes('tgWebAppPlatform=')) return true;
  // Native webviews inject this even when a (buggy) client omits the launch
  // fragment — the webview setup still applies, only auth needs initData.
  if ('TelegramWebviewProxy' in window) return true;
  try {
    return window.sessionStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The signed initData string for API auth, or null outside Telegram (or on the
 * rare launch that carries none). Reads the launch fragment, then the copy
 * stashed by {@link initTelegramMiniApp} (reloads lose the fragment), then the
 * SDK object — some clients surface initData only there.
 */
export function telegramInitData(): string | null {
  if (!isTelegramMiniApp()) return null;
  const fromHash = launchParam('tgWebAppData');
  if (fromHash) return fromHash;
  try {
    const stashed = window.sessionStorage.getItem(INIT_DATA_KEY);
    if (stashed) return stashed;
  } catch {
    // Storage unavailable — fall through to the SDK.
  }
  return window.Telegram?.WebApp?.initData || null;
}

let sdkPromise: Promise<TelegramWebApp | null> | null = null;

/** Inject the official SDK (idempotent). Resolves null if it can't load. */
function loadTelegramSdk(): Promise<TelegramWebApp | null> {
  const existing = window.Telegram?.WebApp;
  if (existing) return Promise.resolve(existing);
  sdkPromise ??= new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => resolve(window.Telegram?.WebApp ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return sdkPromise;
}

let initialized = false;

/**
 * One-shot launch setup inside Telegram: remember the environment, load the
 * SDK, and configure the webview (full height + no swipe-to-minimize, which
 * would swallow the calendar's touch gestures). Resolves with the SDK object
 * (so callers can read `initData` a client delivered only through it), or
 * null outside Telegram / when the SDK can't load.
 */
export async function initTelegramMiniApp(): Promise<TelegramWebApp | null> {
  if (initialized || !isTelegramMiniApp()) return window.Telegram?.WebApp ?? null;
  initialized = true;

  try {
    window.sessionStorage.setItem(FLAG_KEY, '1');
    const initData = launchParam('tgWebAppData');
    if (initData) window.sessionStorage.setItem(INIT_DATA_KEY, initData);
  } catch {
    // Storage unavailable — hash-based detection still covers this load.
  }

  // The SDK reads its launch params from the fragment; restore it if the
  // URL-reflect effect already rewrote the URL by the time we get here.
  if (launchHash && !window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search + launchHash);
  }

  const webApp = await loadTelegramSdk();
  if (!webApp) return null;
  try {
    webApp.ready();
    webApp.expand();
    if (webApp.isVersionAtLeast('7.7')) webApp.disableVerticalSwipes?.();
  } catch {
    // Older Telegram clients — the app still works, just without the extras.
  }
  return webApp;
}
