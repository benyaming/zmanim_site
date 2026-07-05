import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { computeZmanim } from './calculator';

/**
 * Elevation-adjusted zmanim (opt-in via `useElevation`). Semantics under test,
 * matching KosherJava's useElevation and Hebcal's `ue=on`:
 *
 *  - sunrise gets EARLIER and sunset LATER (visible-horizon dip), and every
 *    zman measured from them (fixed-minute offsets, shaos-zmaniyos fractions)
 *    shifts with them;
 *  - degree-based zmanim (alos 16.1°, misheyakir, tzais geonim 5.95°, tzais
 *    8.5°), chatzos and candle lighting intentionally stay sea-level;
 *  - with the flag off the output is IDENTICAL to sea level no matter what
 *    elevation is stored — a nonzero elevation must never leak into the
 *    calculation uninvited (kosher-zmanim's raw getSunrise/getSunset would
 *    honor it even without the flag, shifting only those rows).
 */

const JERUSALEM = { lat: 31.778, lng: 35.2354, elevation: 754 };
const DATE = DateTime.fromISO('2024-03-20');

function byKey(zmanim: ReturnType<typeof computeZmanim>) {
  return Object.fromEntries(zmanim.map((z) => [z.key, z.time ? z.time.toFormat('HH:mm:ss') : null]));
}

describe('computeZmanim with elevation (opt-in)', () => {
  /**
   * Golden values for Jerusalem at 754 m, 2024-03-20 (equinox), cross-validated
   * against the Hebcal API with `ue=on&elev=754`: every comparable time agrees
   * to Hebcal's minute rounding (sunrise 05:38, sunset 17:55, shma GRA 08:42,
   * tzais 72 19:07, …). The MGA keys are excluded from the cross-validation —
   * kosher-zmanim's MGA uses fixed 72 minutes while Hebcal's uses 16.1°; the
   * two only coincide at sea level at the equinox anchor — so those are pinned
   * from our own engine as pure regression values.
   */
  it('Jerusalem at 754 m matches the Hebcal-validated golden values', () => {
    const expected: Record<string, string> = {
      alosHashachar: '04:30:20', // 16.1° — unchanged from sea level
      misheyakir115: '04:52:12', // 11.5° — unchanged
      sunrise: '05:38:21', // sea level 05:42:30
      sofZmanShmaMGA: '08:06:29',
      sofZmanShmaGRA: '08:42:29',
      sofZmanTfilaMGA: '09:19:52',
      sofZmanTfilaGRA: '09:43:52',
      sofZmanAchilasChametzMGA: '09:19:52',
      sofZmanAchilasChametzGRA: '09:43:52',
      sofZmanBiurChametzMGA: '10:33:14',
      sofZmanBiurChametzGRA: '10:45:14',
      chatzos: '11:46:31', // sea-level midpoint by design — unchanged
      minchaGedola: '12:17:18',
      minchaKetana: '15:21:27',
      plagHamincha: '16:38:10',
      candleLighting: '17:32:44', // sea-level sunset − 18 by design — unchanged
      sunset: '17:54:53', // sea level 17:50:44
      tzaisGeonim: '18:14:51', // 5.95° — unchanged
      tzais: '18:26:54', // 8.5° — unchanged
      tzais42: '18:36:53', // elevation-adjusted sunset + 42
      tzais72: '19:06:53', // elevation-adjusted sunset + 72
    };
    const actual = byKey(computeZmanim({ ...JERUSALEM, date: DATE, useElevation: true }));
    for (const [key, time] of Object.entries(expected)) {
      expect(actual[key], key).toBe(time);
    }
  });

  it('is byte-identical to sea level when the flag is off, regardless of stored elevation', () => {
    const seaLevel = byKey(computeZmanim({ lat: JERUSALEM.lat, lng: JERUSALEM.lng, date: DATE }));
    const withStoredElevation = byKey(computeZmanim({ ...JERUSALEM, date: DATE }));
    expect(withStoredElevation).toEqual(seaLevel);
  });

  it('clamps a negative elevation (Dead Sea basin) to sea level instead of throwing', () => {
    const seaLevel = byKey(computeZmanim({ lat: 31.1979, lng: 35.3663, date: DATE }));
    const belowSeaLevel = byKey(
      computeZmanim({ lat: 31.1979, lng: 35.3663, elevation: -391, useElevation: true, date: DATE }),
    );
    expect(belowSeaLevel).toEqual(seaLevel);
  });

  it('shifts sunrise earlier and sunset later, and leaves sea-level-by-design zmanim untouched', () => {
    const cases = [
      { lat: 31.778, lng: 35.2354, elevation: 754, date: '2024-03-20' }, // Jerusalem, equinox
      { lat: 39.7392, lng: -104.9903, elevation: 1609, date: '2024-06-21' }, // Denver, solstice
      { lat: -34.6037, lng: -58.3816, elevation: 25, date: '2024-12-21' }, // Buenos Aires, low elevation
    ];
    const UNCHANGED = ['alosHashachar', 'misheyakir115', 'misheyakir11', 'misheyakir102', 'chatzos', 'candleLighting', 'tzaisGeonim', 'tzais', 'chatzosLaila'];
    for (const c of cases) {
      const date = DateTime.fromISO(c.date);
      const base = Object.fromEntries(
        computeZmanim({ lat: c.lat, lng: c.lng, date }).map((z) => [z.key, z.time]),
      );
      const elev = Object.fromEntries(
        computeZmanim({ ...c, date, useElevation: true }).map((z) => [z.key, z.time]),
      );
      expect(elev.sunrise!.toMillis(), `${c.date} sunrise`).toBeLessThan(base.sunrise!.toMillis());
      expect(elev.sunset!.toMillis(), `${c.date} sunset`).toBeGreaterThan(base.sunset!.toMillis());
      for (const key of UNCHANGED) {
        expect(elev[key]?.toMillis(), `${c.date} ${key}`).toBe(base[key]?.toMillis());
      }
    }
  });
});
