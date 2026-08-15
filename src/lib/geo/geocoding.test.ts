import { afterEach, describe, expect, it, vi } from 'vitest';

import { reverseGeocode } from './geocoding';

describe('reverseGeocode locality override', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('labels coordinates inside a locality from the bundled index, without a network call', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchSpy);
    // Psagot — BigDataCloud labels this "Ramallah".
    await expect(reverseGeocode(31.8987, 35.2241, undefined, 'en')).resolves.toBe('Psagot');
    await expect(reverseGeocode(31.9324, 35.0433, undefined, 'ru')).resolves.toBe('Модиин-Илит');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('labels eastern Rosh HaAyin locally instead of asking for "Salfit"', async () => {
    // Live BigDataCloud returns city="Salfit" for every point more than ~2.2 km
    // east of the center, so this must never reach the network.
    const fetchSpy = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchSpy);
    await expect(reverseGeocode(32.0956, 34.98, undefined, 'en')).resolves.toBe('Rosh HaAyin');
    await expect(reverseGeocode(32.0956, 34.99, undefined, 'he')).resolves.toBe('ראש העין');
    await expect(reverseGeocode(32.0956, 34.98, undefined, 'ru')).resolves.toBe('Рош-ха-Аин');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls through to the network service elsewhere', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ city: 'Brooklyn' }) } as unknown as Response),
    );
    vi.stubGlobal('fetch', fetchSpy);
    await expect(reverseGeocode(40.6782, -73.9442)).resolves.toBe('Brooklyn');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
