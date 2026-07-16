'use client';

import { useSyncExternalStore } from 'react';

import { isTelegramMiniApp } from '@/lib/telegram/mini-app';

const noopSubscribe = () => () => {};
const getServerSnapshot = () => false;

/**
 * Whether the app runs inside Telegram as a Mini App. Hydration-safe: false
 * during SSR and stable after mount (the environment can't change mid-session).
 */
export function useIsMiniApp(): boolean {
  return useSyncExternalStore(noopSubscribe, isTelegramMiniApp, getServerSnapshot);
}
