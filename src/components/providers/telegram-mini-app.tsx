'use client';

import { useEffect, useRef } from 'react';

import {
  CANDLE_OFFSET_MAX,
  CANDLE_OFFSET_MIN,
  makeLocation,
  useAppState,
} from '@/components/providers/app-state';
import type { SavedLocation } from '@/lib/saved-locations';
import { botSyncEnabled, fetchBotProfile, pushBotSync, type BotProfile, type BotSyncPatch } from '@/lib/telegram/bot-sync';
import { initTelegramMiniApp, isTelegramMiniApp, telegramInitData } from '@/lib/telegram/mini-app';
import { isHavdalahOpinion } from '@/lib/zmanim';

/**
 * The bot-side values as of the last successful exchange — the sync baseline.
 * Location is absent on purpose: the app never writes the bot's location, so
 * there is nothing to compare it against (see the write-back below).
 */
interface SyncedState {
  clOffset: number | null;
  havdalaOpinion: string | null;
}

function baselineOf(profile: BotProfile): SyncedState {
  return {
    clOffset: profile.clOffset,
    havdalaOpinion: profile.havdalaOpinion,
  };
}

/**
 * The bot's saved list as picker entries (stable ids so re-renders don't
 * churn). The bot's name rides as the entry's custom name, so selecting one
 * keeps it in the header (like the bot shows it) instead of being replaced by
 * the relabel effect's geocoded city name.
 */
export function botLocationEntries(profile: BotProfile): SavedLocation[] {
  return profile.locations.map((loc) => ({
    id: `bot:${loc.lat},${loc.lng}`,
    name: loc.name,
    location: makeLocation(loc.lat, loc.lng, loc.name, undefined, loc.elevation),
  }));
}

/**
 * Telegram Mini App bridge (renders nothing; see docs/telegram-mini-app.md).
 *
 * On launch inside Telegram it configures the webview (expand, no
 * swipe-to-minimize) and, when the bot API is configured, brings the bot
 * profile into the app: candle offset and havdalah opinion override the local
 * copies (and in-app changes to them are pushed back, debounced, so bot and
 * mini app stay in step), while the bot's location only ever **seeds** a device
 * that has no location of its own and is never written back.
 *
 * The location is one-way-and-only-once because the two acts differ: the bot's
 * location decides where its daily messages come from, whereas the app's is
 * whatever times you are looking at right now. Making them one value meant
 * browsing another city silently moved the bot — and made every launch rewrite
 * prefs, which is what used to put the settings reconcile in a reload loop.
 */
export function TelegramMiniApp() {
  const { applyBotProfile, candleLightingOffset, havdalahOpinion } = useAppState();
  // Null until /me succeeds — write-back stays off unless authenticated.
  const synced = useRef<SyncedState | null>(null);
  // The initData that authenticated /me, reused for write-back pushes.
  const auth = useRef<string | null>(null);

  useEffect(() => {
    if (!isTelegramMiniApp()) return;
    let cancelled = false;
    // Wait for the SDK: telegramInitData falls back to the SDK object on
    // clients that don't deliver the launch fragment to the page.
    void initTelegramMiniApp().then((webApp) => {
      const initData = telegramInitData() ?? (webApp?.initData || null);
      if (cancelled || !botSyncEnabled() || !initData) return;
      auth.current = initData;
      return fetchBotProfile(initData);
    }).then((profile) => {
      if (!profile || cancelled) return;
      synced.current = baselineOf(profile);
      applyBotProfile({
        // The bot's name rides as customLabel so the header shows it verbatim
        // («Дом» stays «Дом»); the relabel effect only re-resolves the
        // underlying geocoded label — otherwise the applied home location
        // re-geocodes to the user's city name and looks like an auto-detected
        // "current location" instead of the bot's saved one.
        location: profile.location
          ? {
              ...makeLocation(
                profile.location.lat,
                profile.location.lng,
                profile.location.name,
                undefined,
                profile.location.elevation,
              ),
              customLabel: profile.location.name,
            }
          : undefined,
        candleLightingOffset:
          profile.clOffset != null
            ? Math.min(CANDLE_OFFSET_MAX, Math.max(CANDLE_OFFSET_MIN, Math.round(profile.clOffset)))
            : undefined,
        havdalahOpinion: isHavdalahOpinion(profile.havdalaOpinion) ? profile.havdalaOpinion : undefined,
        botLocations: botLocationEntries(profile),
      });
    });
    return () => {
      cancelled = true;
    };
    // Mount-only: the launch environment can't change within a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write-back: whenever a synced setting drifts from the bot-side baseline,
  // push it after a short debounce (rapid stepper clicks collapse into one
  // request). The baseline only advances on a confirmed sync, so a failed
  // push retries on the next change instead of being lost silently.
  //
  // The LOCATION is deliberately not among them. Picking a place to look at
  // times for is not the same act as telling the bot where you live — the bot
  // sends its daily messages from its own location, and browsing another city
  // here must not silently move them. The app's location travels between
  // devices in the settings blob like every other setting; the bot's stays the
  // bot's, changed in the bot. (It is still *read*: see the seed above.)
  useEffect(() => {
    const base = synced.current;
    if (!base) return;

    const patch: BotSyncPatch = {};
    if (candleLightingOffset !== base.clOffset) patch.clOffset = candleLightingOffset;
    if (havdalahOpinion !== base.havdalaOpinion) patch.havdalaOpinion = havdalahOpinion;
    if (patch.clOffset === undefined && patch.havdalaOpinion === undefined) return;

    const initData = auth.current;
    if (!initData) return;
    const timer = setTimeout(() => {
      void pushBotSync(initData, patch).then((profile) => {
        if (!profile) return;
        synced.current = baselineOf(profile);
        // A sync can grow the bot's saved list — keep the picker in step.
        applyBotProfile({ botLocations: botLocationEntries(profile) });
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [candleLightingOffset, havdalahOpinion, applyBotProfile]);

  return null;
}
