/**
 * "Sign in with Telegram" on the plain website (outside the Mini App), via
 * Telegram's Login Widget. The widget hands back a signed payload (id, name,
 * auth_date, hash) that the bot API validates statelessly — the same trust
 * model as the Mini App's initData, keyed on SHA256(bot token) instead. The
 * payload is kept in localStorage as the sync credential until it expires or
 * the user disconnects.
 *
 * Needs NEXT_PUBLIC_TG_BOT_USERNAME (the widget is bound to the bot's public
 * username) on top of the bot API URL; the widget domain must also be set
 * once via BotFather's /setdomain.
 */

import { botSyncEnabled } from './bot-sync';

/** The Login Widget's signed payload, stored verbatim — the bot re-checks it. */
export interface TelegramWebAuth {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const AUTH_KEY = 'zmanim:tg-web-auth:v1';
const WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22';
const BOT_USERNAME = process.env.NEXT_PUBLIC_TG_BOT_USERNAME ?? '';
/** Mirrors the bot's widget-payload window; don't send calls doomed to 401. */
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

declare global {
  interface Window {
    /** Callback the Login Widget script invokes with the signed payload. */
    onTelegramAuth?: (user: TelegramWebAuth) => void;
  }
}

export function telegramWebLoginConfigured(): boolean {
  return botSyncEnabled() && BOT_USERNAME !== '';
}

function isFresh(auth: TelegramWebAuth): boolean {
  return auth.auth_date > 0 && Date.now() / 1000 - auth.auth_date < MAX_AGE_SECONDS;
}

/** The stored sign-in, or null when absent/expired/malformed. */
export function loadTelegramWebAuth(): TelegramWebAuth | null {
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    const auth = data as TelegramWebAuth;
    if (typeof auth.id !== 'number' || typeof auth.hash !== 'string' || typeof auth.auth_date !== 'number') {
      return null;
    }
    return isFresh(auth) ? auth : null;
  } catch {
    return null;
  }
}

/** Fired after sign-in/sign-out so listeners (e.g. WebBotProfile) can react. */
export const WEB_AUTH_EVENT = 'zmanim:web-auth';

export function saveTelegramWebAuth(auth: TelegramWebAuth): void {
  try {
    window.localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    window.dispatchEvent(new Event(WEB_AUTH_EVENT));
  } catch {
    // Sync will simply not persist across reloads.
  }
}

export function clearTelegramWebAuth(): void {
  try {
    window.localStorage.removeItem(AUTH_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** A short display name for the "connected as" line. */
export function webAuthDisplayName(auth: TelegramWebAuth): string {
  if (auth.username) return `@${auth.username}`;
  return [auth.first_name, auth.last_name].filter(Boolean).join(' ') || String(auth.id);
}

/**
 * Mount the Login Widget button into `container`. Returns a cleanup that
 * removes it. The widget is an injected script that renders an iframe button
 * and calls the global `onTelegramAuth` with the signed payload.
 */
export function mountTelegramLoginWidget(container: HTMLElement, onAuth: (auth: TelegramWebAuth) => void): () => void {
  window.onTelegramAuth = (user) => {
    if (user && typeof user.id === 'number' && typeof user.hash === 'string') onAuth(user);
  };
  const script = document.createElement('script');
  script.src = WIDGET_SRC;
  script.async = true;
  script.setAttribute('data-telegram-login', BOT_USERNAME);
  script.setAttribute('data-size', 'medium');
  script.setAttribute('data-onauth', 'onTelegramAuth(user)');
  container.appendChild(script);
  return () => {
    delete window.onTelegramAuth;
    container.replaceChildren();
  };
}
