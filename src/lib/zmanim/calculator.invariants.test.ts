import type { DateTime } from 'luxon';
import { DateTime as LuxonDateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { computeZmanim } from './calculator';

/**
 * Astronomical / halachic ordering invariants that must hold for ANY date and
 * location with a normal day structure. We sweep a deterministic grid (no
 * randomness, so failures reproduce) of mid-latitudes across the year.
 *
 * Note: at high latitudes the degree-based tzais (8.5°) can fall after the
 * fixed-72-minute tzais, so their relative order is intentionally NOT asserted.
 */
const LATS = [-55, -34, -20, 0, 20, 31, 40, 51, 55];
const LNGS = [-118, -73, -0.1, 35, 151];
const DATES = ['2024-01-15', '2024-03-20', '2024-06-21', '2024-09-22', '2024-12-21'];

interface Pair {
  before: string;
  after: string;
  strict: boolean;
}

// "before" must be <= (or <) "after" whenever both are defined.
const ORDER: Pair[] = [
  { before: 'alosHashachar', after: 'misheyakir115', strict: false },
  { before: 'misheyakir115', after: 'sunrise', strict: false },
  { before: 'sunrise', after: 'sofZmanShmaMGA', strict: true },
  { before: 'sofZmanShmaMGA', after: 'sofZmanShmaGRA', strict: false },
  { before: 'sofZmanShmaGRA', after: 'sofZmanTfilaGRA', strict: true },
  { before: 'sofZmanTfilaMGA', after: 'sofZmanTfilaGRA', strict: false },
  { before: 'sofZmanTfilaGRA', after: 'chatzos', strict: false },
  { before: 'chatzos', after: 'minchaGedola', strict: true },
  { before: 'minchaGedola', after: 'minchaKetana', strict: true },
  { before: 'minchaKetana', after: 'plagHamincha', strict: true },
  { before: 'plagHamincha', after: 'sunset', strict: true },
  { before: 'candleLighting', after: 'sunset', strict: true },
  { before: 'sunset', after: 'tzais', strict: true },
  { before: 'sunset', after: 'tzais72', strict: true },
];

function timesFor(lat: number, lng: number, date: DateTime): Record<string, DateTime | null> {
  const zmanim = computeZmanim({ lat, lng, date });
  return Object.fromEntries(zmanim.map((z) => [z.key, z.time]));
}

describe('zmanim ordering invariants', () => {
  it('holds the chronological chain across the grid', () => {
    let checks = 0;
    for (const lat of LATS) {
      for (const lng of LNGS) {
        for (const iso of DATES) {
          const t = timesFor(lat, lng, LuxonDateTime.fromISO(iso));
          for (const { before, after, strict } of ORDER) {
            const a = t[before];
            const b = t[after];
            if (!a || !b) continue;
            const label = `${lat},${lng} ${iso}: ${before} <= ${after}`;
            if (strict) {
              expect(a.toMillis(), label).toBeLessThan(b.toMillis());
            } else {
              expect(a.toMillis(), label).toBeLessThanOrEqual(b.toMillis());
            }
            checks++;
          }
        }
      }
    }
    // Make sure the sweep actually exercised a meaningful number of comparisons.
    expect(checks).toBeGreaterThan(1000);
  });

  it('chatzos is the midpoint of sunrise and sunset (within 90s)', () => {
    for (const lat of LATS) {
      for (const iso of DATES) {
        const t = timesFor(lat, 35, LuxonDateTime.fromISO(iso));
        const { sunrise, sunset, chatzos } = t;
        if (!sunrise || !sunset || !chatzos) continue;
        const midpoint = (sunrise.toMillis() + sunset.toMillis()) / 2;
        expect(Math.abs(chatzos.toMillis() - midpoint), `chatzos midpoint ${lat} ${iso}`).toBeLessThan(90_000);
      }
    }
  });

  it('produces deterministic output for identical input', () => {
    const a = computeZmanim({ lat: 40.6782, lng: -73.9442, date: LuxonDateTime.fromISO('2024-06-15') });
    const b = computeZmanim({ lat: 40.6782, lng: -73.9442, date: LuxonDateTime.fromISO('2024-06-15') });
    const fmt = (z: (typeof a)[number]) => `${z.key}:${z.time?.toISO() ?? 'null'}`;
    expect(a.map(fmt)).toEqual(b.map(fmt));
  });
});
