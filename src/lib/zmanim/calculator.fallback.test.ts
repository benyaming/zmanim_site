import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { computeZmanim } from './calculator';
import { ZMANIM } from './definitions';

/**
 * Short-night fallbacks. At high latitudes a degree-based dawn/nightfall time
 * can be undefined (the sun never reaches its depression angle), so computeZmanim
 * substitutes a seasonal-hour (shaah zmanit) approximation and flags it
 * `approximate`. These pins guard that behavior — and that it fires ONLY when
 * the real degree time is null, never overriding it, and never at a true polar
 * day/night where there is no sunrise/sunset to anchor the approximation.
 */
function byKey(zmanim: ReturnType<typeof computeZmanim>) {
  return Object.fromEntries(zmanim.map((z) => [z.key, z]));
}
const fmt = (z: { time: DateTime | null } | undefined) => (z?.time ? z.time.toFormat('HH:mm:ss') : null);

describe('short-night seasonal-hour fallback', () => {
  it('falls back for the 16.1° dawn at London midsummer (method fallback → getAlos72Zmanis)', () => {
    const t = byKey(computeZmanim({ lat: 51.5074, lng: -0.1278, date: DateTime.fromISO('2024-06-21') }));
    expect(t.alosHashachar.approximate).toBe(true);
    expect(fmt(t.alosHashachar)).toBe('03:03:20');
    // The real astronomical times around it are untouched and not flagged.
    expect(t.sunrise.approximate).toBeUndefined();
    expect(fmt(t.sunrise)).toBe('04:43:10');
    // The 16.1° Rabbeinu Tam nightfall also has no degree time here → falls back.
    expect(t.tzais161.approximate).toBe(true);
  });

  it('falls back for offset-anchored dawn/night at Helsinki midsummer', () => {
    const t = byKey(
      computeZmanim({ lat: 60, lng: 25, date: DateTime.fromISO('2024-06-21'), timeZoneId: 'Europe/Helsinki' }),
    );
    // 10.2° misheyakir has no degree time → 44 seasonal minutes before sunrise.
    expect(t.misheyakir102.approximate).toBe(true);
    expect(fmt(t.misheyakir102)).toBe('02:46:38');
    // 8.5° nightfall has no degree time → 36 seasonal minutes after sunset.
    expect(t.tzais.approximate).toBe(true);
    expect(fmt(t.tzais)).toBe('23:44:33');
    // But the 5.95° nightfall IS reached at this latitude → real, not flagged.
    expect(t.tzaisGeonim.approximate).toBeUndefined();
    expect(fmt(t.tzaisGeonim)).toBe('00:32:29');
  });

  it('never approximates on a normal day (Jerusalem equinox)', () => {
    const zmanim = computeZmanim({ lat: 31.778, lng: 35.2354, date: DateTime.fromISO('2024-03-20') });
    expect(zmanim.some((z) => z.approximate)).toBe(false);
  });

  it('stays null (no approximation) at a true polar day — no sunrise to anchor it', () => {
    const zmanim = computeZmanim({ lat: 69.6492, lng: 18.9553, date: DateTime.fromISO('2024-06-21') });
    const t = byKey(zmanim);
    for (const key of ['alosHashachar', 'misheyakir102', 'tzais', 'tzais161']) {
      expect(t[key].time, key).toBeNull();
      expect(t[key].approximate, key).toBeFalsy();
    }
    // Every key is still returned (the polar edge test's contract).
    expect(zmanim).toHaveLength(ZMANIM.length);
  });

  it('applies to a key subset the same way as a full compute', () => {
    const opts = { lat: 51.5074, lng: -0.1278, date: DateTime.fromISO('2024-06-21') } as const;
    const full = byKey(computeZmanim(opts));
    const subset = byKey(computeZmanim({ ...opts, keys: ['alosHashachar'] }));
    expect(subset.alosHashachar.approximate).toBe(true);
    expect(fmt(subset.alosHashachar)).toBe(fmt(full.alosHashachar));
  });
});
