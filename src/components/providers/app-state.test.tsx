import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The deep-link location is session-only.
 *
 * The load-bearing rule: a location arriving via the URL (?lat=&lng= — a shared
 * link, or the bot's personalized Mini App launch URL, which carries the bot's
 * coordinates on EVERY open) is shown for the session but NEVER persisted.
 * Persisting it rewrote prefs with the bot's location at every launch, which
 * kept the device diverged from the synced settings blob — and made the startup
 * sync reconcile adopt the blob and reload the Mini App once on every open.
 */

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/geo/browser-location', () => ({ browserGeolocate: async () => null }));
vi.mock('@/lib/geo/ip-location', () => ({ ipGeolocate: async () => null }));
vi.mock('@/lib/geo/elevation', () => ({ fetchElevation: async () => null }));
vi.mock('@/lib/geo/geocoding', () => ({ reverseGeocode: async () => null }));

import { installMemoryLocalStorage } from '@/test/memory-storage';

const { AppStateProvider, makeLocation, PREFS_STORAGE_KEY, useAppState } = await import('./app-state');

let state: ReturnType<typeof useAppState>;
function Probe() {
  const ctx = useAppState();
  useEffect(() => {
    state = ctx;
  });
  return null;
}

/** A saved location as prefs would hold it — round-tripped verbatim. */
const STORED_LOCATION = {
  lat: 55.7558,
  lng: 37.6173,
  timeZoneId: 'Europe/Moscow',
  label: 'Москва',
  labelLocale: 'ru',
  inIsrael: false,
  elevation: 150,
};

// The bot's launch-URL location (elevation included, as the bot links carry it).
const deepLink = () => makeLocation(32.08, 34.78, 'Дом', undefined, 45);

const persisted = () =>
  JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY) ?? 'null') as Record<string, unknown> | null;

beforeEach(() => {
  installMemoryLocalStorage();
});

describe('deep-link location persistence', () => {
  it('shows the deep-link location but keeps the saved one persisted, verbatim', () => {
    window.localStorage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({ location: STORED_LOCATION, candleLightingOffset: 30 }),
    );

    render(
      <AppStateProvider initialLocation={deepLink()}>
        <Probe />
      </AppStateProvider>,
    );

    // The session shows the deep link…
    expect(state.location).toMatchObject({ lat: 32.08, lng: 34.78 });
    // …while prefs keep the saved location untouched (same content the sync
    // blob holds — nothing for the startup reconcile to adopt).
    expect(persisted()?.location).toEqual(STORED_LOCATION);
    expect(persisted()?.candleLightingOffset).toBe(30);
  });

  it('persists no location at all when the device had none saved', () => {
    render(
      <AppStateProvider initialLocation={deepLink()}>
        <Probe />
      </AppStateProvider>,
    );

    expect(state.location).toMatchObject({ lat: 32.08, lng: 34.78 });
    expect(persisted()).not.toHaveProperty('location');
  });

  it('an explicit in-session pick replaces the persisted location', () => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ location: STORED_LOCATION }));

    render(
      <AppStateProvider initialLocation={deepLink()}>
        <Probe />
      </AppStateProvider>,
    );
    act(() => {
      state.setLocation(makeLocation(31.7683, 35.2137, 'Jerusalem'));
    });

    expect(persisted()?.location).toMatchObject({ lat: 31.7683, lng: 35.2137 });
  });

  it('without a deep link the saved location loads and persists as before', () => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ location: STORED_LOCATION }));

    render(
      <AppStateProvider>
        <Probe />
      </AppStateProvider>,
    );

    expect(state.location).toMatchObject({ lat: 55.7558, lng: 37.6173 });
    expect(persisted()?.location).toMatchObject({ lat: 55.7558, lng: 37.6173 });
  });
});
