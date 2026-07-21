'use client';

import { useEffect } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { botLocationEntries } from '@/components/providers/telegram-mini-app';
import { botSyncEnabled, fetchBotProfile } from '@/lib/telegram/bot-sync';
import { isTelegramMiniApp } from '@/lib/telegram/mini-app';
import { loadTelegramWebAuth, WEB_AUTH_EVENT } from '@/lib/telegram/web-login';

/**
 * On the plain website, once signed in with the Telegram Login Widget, surface
 * the bot's saved locations in the picker — the same list the Mini App shows
 * from initData, here fetched with the stored web auth. (Renders nothing.)
 *
 * The settings blob syncs everything else; the bot's `locations` list isn't in
 * it, so it's fetched separately. Inside the Mini App this is handled by
 * TelegramMiniApp instead.
 */
export function WebBotProfile() {
  const { applyBotProfile } = useAppState();

  useEffect(() => {
    if (isTelegramMiniApp()) return; // the Mini App provider owns that context
    let cancelled = false;
    const pull = () => {
      const auth = loadTelegramWebAuth();
      if (!botSyncEnabled() || !auth) return;
      void fetchBotProfile({ authData: { ...auth } }).then((profile) => {
        if (profile && !cancelled) applyBotProfile({ botLocations: botLocationEntries(profile) });
      });
    };
    pull(); // on load, if already signed in
    window.addEventListener(WEB_AUTH_EVENT, pull); // and right after a fresh sign-in
    return () => {
      cancelled = true;
      window.removeEventListener(WEB_AUTH_EVENT, pull);
    };
  }, [applyBotProfile]);

  return null;
}
