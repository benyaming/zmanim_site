import { afterEach, describe, expect, it, vi } from 'vitest';

import { reverseGeocode } from './geocoding';

describe('reverseGeocode settlement override', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('labels coordinates inside a settlement from the bundled index, without a network call', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchSpy);
    // Psagot — BigDataCloud labels this "Ramallah".
    await expect(reverseGeocode(31.8987, 35.2241, undefined, 'en')).resolves.toBe('Psagot');
    await expect(reverseGeocode(31.9324, 35.0433, undefined, 'ru')).resolves.toBe('Модиин-Илит');
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
