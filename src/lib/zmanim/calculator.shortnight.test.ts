import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { computeZmanim, isPolarDay } from './calculator';
import { ZMANIM } from './definitions';

/**
 * Short nights at high latitude. When the sun never reaches a zman's depression
 * angle, that opinion has NO time — and the engine says so, rather than filling
 * the gap from another family.
 *
 * These pins guard the contract that makes the display honest: a `degrees` zman
 * goes null, its `fixedMinutes` and `seasonalMinutes` neighbours still resolve,
 * and no minute-based number is ever attributed to a degree-based key. Which
 * dawn a short-night location should keep is an open machloket; the engine
 * reports every shita and rules between none of them.
 */
function byKey(zmanim: ReturnType<typeof computeZmanim>) {
  return Object.fromEntries(zmanim.map((z) => [z.key, z]));
}
const fmt = (z: { time: DateTime | null } | undefined) => (z?.time ? z.time.toFormat('HH:mm:ss') : null);

describe('short nights leave degree-based zmanim undefined', () => {
  /**
   * The regression this whole contract exists for. Düsseldorf, 2 July: the sun
   * bottoms out ~15.7° below the horizon, so there is no 16.1° dawn at all.
   * myzmanim prints its "dawn degrees" as X:XX here and publishes 4:10 AM under
   * "dawn fixed minutes" — which is `alos72`, to the minute. We previously
   * showed 03:43 (the 72-SEASONAL-minute time, 99 real minutes before sunrise)
   * under the 16.1° label: both 27 minutes off myzmanim and attributed to a
   * shita that never produced it.
   */
  it('matches myzmanim at Düsseldorf midsummer: no degree dawn, fixed-72 dawn at 4:10', () => {
    const t = byKey(
      computeZmanim({ lat: 51.2277, lng: 6.7735, date: DateTime.fromISO('2026-07-02'), timeZoneId: 'Europe/Berlin' }),
    );
    expect(fmt(t.sunrise)).toBe('05:22:10');
    // No 16.1° dawn here — and nothing invented in its place.
    expect(t.alosHashachar.time).toBeNull();
    expect(t.alosHashachar.family).toBe('degrees');
    // myzmanim's "dawn fixed minutes", 4:10 AM.
    expect(fmt(t.alos72)).toBe('04:10:10');
    // The seasonal-minute opinion is a real, separate shita — and NOT what the
    // degree row shows. This 27-minute spread is exactly what the old fallback
    // collapsed by printing the seasonal time under the degree label.
    expect(fmt(t.alos72Zmanis)).toBe('03:43:14');
  });

  it('leaves every unreachable degree zman null while its minute neighbours resolve (London midsummer)', () => {
    const t = byKey(computeZmanim({ lat: 51.5074, lng: -0.1278, date: DateTime.fromISO('2024-06-21') }));
    // The 16.1° dawn and the 16.1° Rabbeinu Tam nightfall are both out of reach.
    expect(t.alosHashachar.time).toBeNull();
    expect(t.tzais161.time).toBeNull();
    // Their minute-based counterparts are unaffected — a real sunrise/sunset is
    // all they need, so a short night never blanks them.
    expect(t.alos72.time).not.toBeNull();
    expect(t.alos72Zmanis.time).not.toBeNull();
    expect(t.tzais72.time).not.toBeNull();
    expect(t.tzais72Zmanis.time).not.toBeNull();
    // The real astronomical times around them are untouched.
    expect(fmt(t.sunrise)).toBe('04:43:10');
  });

  it('never blanks a degree zman the sun does reach (Helsinki midsummer)', () => {
    const t = byKey(
      computeZmanim({ lat: 60, lng: 25, date: DateTime.fromISO('2024-06-21'), timeZoneId: 'Europe/Helsinki' }),
    );
    // At 60°N in June the sun clears 5.95° but not 8.5° or 10.2°: the boundary
    // runs THROUGH the degrees family, which is why family is per-zman and the
    // blank has to be decided per-row rather than per-location.
    expect(fmt(t.tzaisGeonim)).toBe('00:32:29');
    expect(t.tzais.time).toBeNull();
    expect(t.misheyakir102.time).toBeNull();
  });

  it('resolves every zman on a normal day (Jerusalem equinox)', () => {
    const zmanim = computeZmanim({ lat: 31.778, lng: 35.2354, date: DateTime.fromISO('2024-03-20') });
    const blank = zmanim.filter((z) => !z.duration && !z.time).map((z) => z.key);
    expect(blank).toEqual([]);
  });

  it('returns every key, all null, at a true polar day', () => {
    const zmanim = computeZmanim({ lat: 69.6492, lng: 18.9553, date: DateTime.fromISO('2024-06-21') });
    const t = byKey(zmanim);
    // No sunrise or sunset at all, so the minute-based opinions have no anchor
    // either — everything goes null, not just the degrees family.
    for (const key of ['alosHashachar', 'alos72', 'alos72Zmanis', 'misheyakir102', 'tzais', 'tzais161']) {
      expect(t[key].time, key).toBeNull();
    }
    // Every key is still returned (the polar edge test's contract).
    expect(zmanim).toHaveLength(ZMANIM.length);
  });

  it('applies to a key subset the same way as a full compute', () => {
    const opts = { lat: 51.5074, lng: -0.1278, date: DateTime.fromISO('2024-06-21') } as const;
    const full = byKey(computeZmanim(opts));
    const subset = byKey(computeZmanim({ ...opts, keys: ['alosHashachar', 'alos72'] }));
    expect(subset.alosHashachar.time).toBeNull();
    expect(fmt(subset.alos72)).toBe(fmt(full.alos72));
  });
});

describe('isPolarDay', () => {
  it('is false on a short summer night (there is still a sunrise and sunset)', () => {
    // London midsummer: degree zmanim are null, but the sun rises and sets, so
    // the short-night explanation applies (other opinions resolve).
    expect(isPolarDay(computeZmanim({ lat: 51.5074, lng: -0.1278, date: DateTime.fromISO('2024-06-21') }))).toBe(false);
  });

  it('is true at a true polar day (no sunrise or sunset to anchor anything)', () => {
    expect(isPolarDay(computeZmanim({ lat: 69.6492, lng: 18.9553, date: DateTime.fromISO('2024-06-21') }))).toBe(true);
  });

  it('is false on a normal day', () => {
    expect(isPolarDay(computeZmanim({ lat: 31.778, lng: 35.2354, date: DateTime.fromISO('2024-03-20') }))).toBe(false);
  });
});

