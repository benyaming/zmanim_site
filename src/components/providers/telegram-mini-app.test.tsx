import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BotProfile } from '@/lib/telegram/bot-sync';

/**
 * What the Mini App bridge is allowed to write back to the bot.
 *
 * The load-bearing rule: NEVER the location. The bot's location decides where
 * its daily messages come from; the app's is whatever times the user is looking
 * at right now. Browsing another city here must not move the bot's — so the
 * bot's location is read (as a seed) and never written.
 */

const applyBotProfile = vi.fn();
const pushBotSync = vi.fn((...args: unknown[]) => Promise.resolve(args && null as BotProfile | null));
const fetchBotProfile = vi.fn(async (): Promise<BotProfile | null> => PROFILE);

let appState = {} as ReturnType<typeof makeState>;

const PROFILE: BotProfile = {
  language: 'ru',
  clOffset: 18,
  havdalaOpinion: 'tzais_8_5',
  location: { lat: 32.08, lng: 34.78, name: 'Дом' },
  locations: [{ lat: 32.08, lng: 34.78, name: 'Дом' }],
  webPrefs: null,
};

function makeState(overrides: { candleLightingOffset?: number; havdalahOpinion?: string } = {}) {
  return {
    applyBotProfile,
    candleLightingOffset: overrides.candleLightingOffset ?? 18,
    havdalahOpinion: overrides.havdalahOpinion ?? 'tzais_8_5',
  };
}

vi.mock('@/components/providers/app-state', () => ({
  CANDLE_OFFSET_MIN: 0,
  CANDLE_OFFSET_MAX: 120,
  makeLocation: (lat: number, lng: number, label: string) => ({ lat, lng, label }),
  useAppState: () => appState,
}));
vi.mock('@/lib/telegram/mini-app', () => ({
  isTelegramMiniApp: () => true,
  initTelegramMiniApp: () => Promise.resolve({ initData: 'init-data' }),
  telegramInitData: () => 'init-data',
}));
vi.mock('@/lib/telegram/bot-sync', () => ({
  botSyncEnabled: () => true,
  fetchBotProfile: () => fetchBotProfile(),
  pushBotSync: (auth: unknown, patch: unknown) => pushBotSync(auth as never, patch as never),
}));

const { TelegramMiniApp } = await import('./telegram-mini-app');

beforeEach(() => {
  vi.useFakeTimers();
  appState = makeState();
  applyBotProfile.mockClear();
  pushBotSync.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TelegramMiniApp write-back', () => {
  it('brings the bot profile in at launch, location included (it seeds the app)', async () => {
    render(<TelegramMiniApp />);
    await vi.advanceTimersByTimeAsync(0); // /me resolves

    expect(applyBotProfile).toHaveBeenCalledTimes(1);
    const applied = applyBotProfile.mock.calls[0][0] as Record<string, unknown>;
    expect(applied.location).toMatchObject({ lat: 32.08, lng: 34.78 });
    expect(applied.candleLightingOffset).toBe(18);
    // Whether that location is actually taken is app-state's call — it seeds a
    // device with no location of its own and never overrides one.
  });

  it('pushes a candle-offset change — and nothing else', async () => {
    const { rerender } = render(<TelegramMiniApp />);
    await vi.advanceTimersByTimeAsync(0);

    appState = makeState({ candleLightingOffset: 40 });
    rerender(<TelegramMiniApp />);
    await vi.advanceTimersByTimeAsync(1000); // past the write-back debounce

    expect(pushBotSync).toHaveBeenCalledTimes(1);
    expect(pushBotSync.mock.calls[0][1]).toEqual({ clOffset: 40 });
  });

  it('never writes the location back, whatever changes', async () => {
    const { rerender } = render(<TelegramMiniApp />);
    await vi.advanceTimersByTimeAsync(0);

    appState = makeState({ havdalahOpinion: 'tzais_72' });
    rerender(<TelegramMiniApp />);
    await vi.advanceTimersByTimeAsync(1000);

    expect(pushBotSync).toHaveBeenCalledTimes(1);
    const patch = pushBotSync.mock.calls[0][1] as Record<string, unknown>;
    expect(patch).not.toHaveProperty('location');
    expect(Object.keys(patch)).toEqual(['havdalaOpinion']);
  });

  it('pushes nothing at all when only the location would have changed', async () => {
    // The component no longer subscribes to the app's location, so a re-render
    // after moving the map/picker produces no bot traffic whatsoever.
    const { rerender } = render(<TelegramMiniApp />);
    await vi.advanceTimersByTimeAsync(0);

    appState = makeState(); // same offsets, a location change elsewhere in the app
    rerender(<TelegramMiniApp />);
    await vi.advanceTimersByTimeAsync(1000);

    expect(pushBotSync).not.toHaveBeenCalled();
  });
});
