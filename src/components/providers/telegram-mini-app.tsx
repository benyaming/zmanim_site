'use client';

import { useEffect, useRef } from 'react';

import {
  CANDLE_OFFSET_MAX,
  CANDLE_OFFSET_MIN,
  makeLocation,
  useAppState,
} from '@/components/providers/app-state';
import { isDefaultLocation } from '@/lib/location';
import type { SavedLocation } from '@/lib/saved-locations';
import { botSyncEnabled, fetchBotProfile, pushBotSync, type BotProfile, type BotSyncPatch } from '@/lib/telegram/bot-sync';
import { initTelegramMiniApp, isTelegramMiniApp, telegramInitData } from '@/lib/telegram/mini-app';
import { isHavdalahOpinion } from '@/lib/zmanim';

/** The bot-side values as of the last successful exchange — the sync baseline. */
interface SyncedState {
  lat: number | null;
  lng: number | null;
  clOffset: number | null;
  havdalaOpinion: string | null;
}

function baselineOf(profile: BotProfile): SyncedState {
  return {
    lat: profile.location?.lat ?? null,
    lng: profile.location?.lng ?? null,
    clOffset: profile.clOffset,
    havdalaOpinion: profile.havdalaOpinion,
  };
}

/** The bot's saved list as picker entries (stable ids so re-renders don't churn). */
function botLocationEntries(profile: BotProfile): SavedLocation[] {
  return profile.locations.map((loc) => ({
    id: `bot:${loc.lat},${loc.lng}`,
    name: '',
    location: makeLocation(loc.lat, loc.lng, loc.name, undefined, loc.elevation),
  }));
}

/**
 * Telegram Mini App bridge (renders nothing; see docs/telegram-mini-app.md).
 *
 * On launch inside Telegram it configures the webview (expand, no
 * swipe-to-minimize) and, when the bot API is configured, mirrors the bot
 * profile into the app — the bot is the source of truth in this context, so
 * its location/candle-offset/havdalah override the locally persisted ones
 * (but never an explicit change the user just made here; see
 * applyBotProfile). Afterwards, in-app changes to those settings are pushed
 * back, debounced, so the bot and the mini app stay in step.
 */
export function TelegramMiniApp() {
  const { applyBotProfile, location, candleLightingOffset, havdalahOpinion } = useAppState();
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
        location: profile.location
          ? makeLocation(
              profile.location.lat,
              profile.location.lng,
              profile.location.name,
              undefined,
              profile.location.elevation,
            )
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
  useEffect(() => {
    const base = synced.current;
    if (!base) return;

    const patch: BotSyncPatch = {};
    // The un-chosen default (fallback Jerusalem) is not a location choice —
    // never push it over the bot's saved location.
    if (!isDefaultLocation(location) && (location.lat !== base.lat || location.lng !== base.lng)) {
      patch.location = {
        lat: location.lat,
        lng: location.lng,
        name: location.customLabel || location.label,
        elevation: location.elevation,
      };
    }
    if (candleLightingOffset !== base.clOffset) patch.clOffset = candleLightingOffset;
    if (havdalahOpinion !== base.havdalaOpinion) patch.havdalaOpinion = havdalahOpinion;
    if (!patch.location && patch.clOffset === undefined && patch.havdalaOpinion === undefined) return;

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
  }, [location, candleLightingOffset, havdalahOpinion, applyBotProfile]);

  return null;
}
