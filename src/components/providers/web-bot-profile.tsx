'use client';

import { useEffect, useRef } from 'react';

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
  // One on-load pull per mount, however often the effect re-runs. The effect
  // is keyed on applyBotProfile, whose identity can change with provider
  // renders — re-fetching the profile on every such re-run turned into a
  // fetch loop once the fetch itself caused a render (see applyBotProfile's
  // botLocations bail, the other half of this fix).
  const pulledOnLoad = useRef(false);

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
    if (!pulledOnLoad.current) {
      pulledOnLoad.current = true;
      pull(); // on load, if already signed in
    }
    window.addEventListener(WEB_AUTH_EVENT, pull); // and right after a fresh sign-in
    return () => {
      cancelled = true;
      window.removeEventListener(WEB_AUTH_EVENT, pull);
    };
  }, [applyBotProfile]);

  return null;
}
