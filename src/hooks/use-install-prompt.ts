'use client';

import { useSyncExternalStore } from 'react';

/** Chrome-family `beforeinstallprompt` event — not yet in TypeScript's lib.dom. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * - `available` — the browser fired `beforeinstallprompt`; we can re-trigger it.
 * - `installed` — running standalone, or an install was observed this session.
 * - `manual` — no prompt to offer (iOS, Firefox, already installed but viewed
 *   in a tab, or the event was consumed) — show instructions instead.
 */
export type InstallStatus = 'available' | 'installed' | 'manual';

let deferredEvent: BeforeInstallPromptEvent | null = null;
let appInstalled = false;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

// The browser fires `beforeinstallprompt` once, early — long before any
// settings dialog is opened, and possibly before this bundle even loads (the
// layout's inline head script stashes that case on window.__zmanimBip).
// `preventDefault()` is deliberately NOT called: the browser's own install
// suggestion (omnibox icon / mini-infobar) stays intact, and the stashed event
// lets settings re-trigger the prompt for users who skipped it.
if (typeof window !== 'undefined') {
  const stash = window as Window & { __zmanimBip?: BeforeInstallPromptEvent };
  deferredEvent = stash.__zmanimBip ?? null;
  // The event is one-shot — drop the global so nothing reuses it stale.
  delete stash.__zmanimBip;
  window.addEventListener('beforeinstallprompt', (event) => {
    deferredEvent = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredEvent = null;
    appInstalled = true;
    notify();
  });
}

function isStandalone(): boolean {
  return (
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    // iOS Safari's non-standard flag for home-screen apps.
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getStatus = (): InstallStatus => {
  if (appInstalled || isStandalone()) return 'installed';
  if (deferredEvent) return 'available';
  return 'manual';
};

const getServerStatus = (): InstallStatus => 'manual';

/**
 * Re-trigger the browser's install prompt from the stashed event. An event can
 * `prompt()` only once, so it is consumed up front — a dismissed or failed
 * prompt degrades to the `manual` instructions state rather than a dead button
 * (Chrome fires a fresh `beforeinstallprompt` later if the user changes their
 * mind).
 */
export async function promptInstall(): Promise<void> {
  const event = deferredEvent;
  if (!event) return;
  deferredEvent = null;
  notify();
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') {
      appInstalled = true;
      notify();
    }
  } catch {
    // The browser already consumed the event via its own UI (or refused the
    // call) — the `manual` state's instructions cover this.
  }
}

/**
 * iOS-family browsers never fire `beforeinstallprompt`; the only install path
 * is Share → Add to Home Screen, so the manual hint must say that. Modern
 * iPads report as Macintosh — the touch-points check tells them apart.
 */
export function isIosFamily(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function useInstallPrompt(): InstallStatus {
  return useSyncExternalStore(subscribe, getStatus, getServerStatus);
}
