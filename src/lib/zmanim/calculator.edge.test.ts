import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { computeZmanim } from './calculator';
import { ZMANIM } from './definitions';

function byKey(zmanim: ReturnType<typeof computeZmanim>) {
  return Object.fromEntries(zmanim.map((z) => [z.key, z.time]));
}

describe('zmanim edge cases', () => {
  it('returns null (never a wrong time) for polar day with no sunset — Tromsø midsummer', () => {
    const zmanim = computeZmanim({ lat: 69.6492, lng: 18.9553, date: DateTime.fromISO('2024-06-21') });
    const t = byKey(zmanim);
    // Midnight sun: there is no sunrise/sunset event.
    expect(t.sunrise).toBeNull();
    expect(t.sunset).toBeNull();
    // The computation must not throw and must still return every defined zman key.
    expect(zmanim).toHaveLength(ZMANIM.length);
  });

  it('returns null for polar night with no sunrise — Tromsø midwinter', () => {
    const t = byKey(computeZmanim({ lat: 69.6492, lng: 18.9553, date: DateTime.fromISO('2024-12-21') }));
    expect(t.sunrise).toBeNull();
    expect(t.sunset).toBeNull();
  });

  it('renders the correct local offset across a DST boundary (Los Angeles)', () => {
    const winter = byKey(computeZmanim({ lat: 34.0522, lng: -118.2437, date: DateTime.fromISO('2024-01-15') }));
    const summer = byKey(computeZmanim({ lat: 34.0522, lng: -118.2437, date: DateTime.fromISO('2024-07-15') }));
    // PST = UTC-8 in January, PDT = UTC-7 in July.
    expect(winter.sunrise!.offset).toBe(-8 * 60);
    expect(summer.sunrise!.offset).toBe(-7 * 60);
  });

  it('higher elevation yields an earlier sunrise and later sunset', () => {
    const date = DateTime.fromISO('2024-03-20');
    const seaLevel = byKey(computeZmanim({ lat: 31.778, lng: 35.2354, date, elevation: 0 }));
    const mountain = byKey(computeZmanim({ lat: 31.778, lng: 35.2354, date, elevation: 800 }));
    expect(mountain.sunrise!.toMillis()).toBeLessThan(seaLevel.sunrise!.toMillis());
    expect(mountain.sunset!.toMillis()).toBeGreaterThan(seaLevel.sunset!.toMillis());
  });

  it('applies the candle-lighting offset relative to sunset', () => {
    const date = DateTime.fromISO('2024-03-22'); // a Friday
    const loc = { lat: 31.778, lng: 35.2354, date };
    const t18 = byKey(computeZmanim({ ...loc, candleLightingOffset: 18 }));
    const t40 = byKey(computeZmanim({ ...loc, candleLightingOffset: 40 }));
    const sunset = t18.sunset!;
    expect(Math.round(sunset.diff(t18.candleLighting!, 'minutes').minutes)).toBe(18);
    expect(Math.round(sunset.diff(t40.candleLighting!, 'minutes').minutes)).toBe(40);
  });

  it('does not throw for extreme / out-of-range coordinates', () => {
    expect(() => computeZmanim({ lat: 89.9, lng: 179.9, date: DateTime.fromISO('2024-06-21') })).not.toThrow();
    expect(() => computeZmanim({ lat: -89.9, lng: -179.9, date: DateTime.fromISO('2024-12-21') })).not.toThrow();
  });

  it('honors an explicitly provided timezone id over lat/lng lookup', () => {
    const t = byKey(computeZmanim({ lat: 31.778, lng: 35.2354, date: DateTime.fromISO('2024-03-20'), timeZoneId: 'UTC' }));
    expect(t.sunrise!.zoneName).toBe('UTC');
  });
});
