import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { computeZmanim } from './calculator';

/**
 * Golden regression fixtures. Each expected value is the local wall-clock time
 * (HH:mm:ss in the location's own timezone) for that city/date at sea level
 * (elevation 0), candle-lighting offset 18 min.
 *
 * The Jerusalem row is cross-validated TO THE SECOND against the Hebcal API
 * (see the dedicated oracle test below). The other rows lock our wiring so any
 * regression in tz handling, method mapping, or date logic fails loudly.
 */
interface GoldenCase {
  name: string;
  lat: number;
  lng: number;
  date: string;
  expected: Record<string, string | null>;
}

const CASES: GoldenCase[] = [
  {
    name: 'Jerusalem (equinox, Hebcal-validated)',
    lat: 31.778,
    lng: 35.2354,
    date: '2024-03-20',
    expected: {
      alosHashachar: '04:30:20',
      misheyakir115: '04:52:12',
      sunrise: '05:42:30',
      sofZmanShmaMGA: '08:08:33',
      sofZmanShmaGRA: '08:44:33',
      sofZmanTfilaMGA: '09:21:15',
      sofZmanTfilaGRA: '09:45:15',
      // Chametz deadlines — computed for every date (the Erev Pesach gating is
      // display-only, so this equinox row still pins them): achilas = end of
      // the 4th hour (same instant as sof zman tfila per opinion), biur = 5th.
      sofZmanAchilasChametzMGA: '09:21:15',
      sofZmanAchilasChametzGRA: '09:45:15',
      sofZmanBiurChametzMGA: '10:33:56',
      sofZmanBiurChametzGRA: '10:45:56',
      chatzos: '11:46:31',
      minchaGedola: '12:16:58',
      minchaKetana: '15:19:01',
      plagHamincha: '16:34:53',
      candleLighting: '17:32:44',
      sunset: '17:50:44',
      tzais: '18:26:54',
      tzais42: '18:32:44', // sunset + 42 fixed minutes
      tzais72: '19:02:44',
    },
  },
  {
    name: 'Brooklyn (winter solstice)',
    lat: 40.6782,
    lng: -73.9442,
    date: '2024-12-21',
    expected: {
      alosHashachar: '05:48:07',
      misheyakir115: '06:13:50',
      sunrise: '07:16:28',
      sofZmanShmaGRA: '09:35:20',
      chatzos: '11:53:57',
      sunset: '16:31:55',
      tzais72: '17:43:55',
    },
  },
  {
    name: 'London (summer solstice, high latitude)',
    lat: 51.5074,
    lng: -0.1278,
    date: '2024-06-21',
    expected: {
      alosHashachar: null, // 16.1° dawn never reached at this latitude/season
      sunrise: '04:43:10',
      sofZmanShmaGRA: '08:52:48',
      chatzos: '13:02:19',
      sunset: '21:21:40',
      tzais: '22:36:32',
      tzais72: '22:33:40',
    },
  },
  {
    name: 'Buenos Aires (southern-hemisphere winter)',
    lat: -34.6037,
    lng: -58.3816,
    date: '2024-06-21',
    expected: {
      sunrise: '08:00:26',
      sofZmanShmaGRA: '10:27:58',
      chatzos: '12:55:22',
      sunset: '17:50:32',
      tzais72: '19:02:32',
    },
  },
  {
    name: 'Los Angeles (US DST fall-back day)',
    lat: 34.0522,
    lng: -118.2437,
    date: '2024-11-03',
    expected: {
      alosHashachar: '04:59:12',
      sunrise: '06:14:57',
      sofZmanShmaGRA: '08:55:37',
      chatzos: '11:36:29',
      sunset: '16:57:37',
      tzais72: '18:09:37',
    },
  },
];

describe('computeZmanim golden values', () => {
  for (const c of CASES) {
    it(c.name, () => {
      const zmanim = computeZmanim({ lat: c.lat, lng: c.lng, date: DateTime.fromISO(c.date) });
      const byKey = Object.fromEntries(zmanim.map((z) => [z.key, z]));
      for (const [key, expected] of Object.entries(c.expected)) {
        const zman = byKey[key];
        expect(zman, `missing zman ${key}`).toBeDefined();
        const actual = zman.time ? zman.time.toFormat('HH:mm:ss') : null;
        expect(actual, `${c.name} :: ${key}`).toBe(expected);
      }
    });
  }

  it('pins the astronomical hour durations (Jerusalem equinox)', () => {
    const zmanim = computeZmanim({ lat: 31.778, lng: 35.2354, date: DateTime.fromISO('2024-03-20') });
    const byKey = Object.fromEntries(zmanim.map((z) => [z.key, z]));
    // Sunrise 05:42:30 → sunset 17:50:44 is 12h08m14s of daylight; one GRA hour
    // is a twelfth of that, and each MGA hour is exactly 12 minutes longer
    // (the 2 × 72 fixed minutes spread over 12 hours).
    expect(Math.round(byKey.shaahZmanisGRA.durationMillis!)).toBe(3_641_196);
    expect(Math.round(byKey.shaahZmanisMGA.durationMillis!)).toBe(4_361_196);
    expect(byKey.shaahZmanisGRA.time).toBeNull();
    expect(byKey.shaahZmanisMGA.time).toBeNull();
  });

  it('renders in the location timezone, independent of the host timezone', () => {
    const zmanim = computeZmanim({ lat: 31.778, lng: 35.2354, date: DateTime.fromISO('2024-03-20') });
    const sunrise = zmanim.find((z) => z.key === 'sunrise')!;
    expect(sunrise.time!.zoneName).toBe('Asia/Jerusalem');
  });

  /**
   * The additional (opt-in) shitot, pinned at the Jerusalem equinox. These lock
   * our method WIRING — each value is produced by the exact KosherJava
   * calculation named in definitions.ts. The engine itself is Hebcal-validated
   * to the second by the Jerusalem case above, and the ordering-invariants
   * sweep guards their chronology across latitudes/seasons; this block guards
   * that the right method stays bound to the right key.
   */
  it('pins the added shitot (wiring locks, Jerusalem equinox)', () => {
    const zmanim = computeZmanim({ lat: 31.778, lng: 35.2354, date: DateTime.fromISO('2024-03-20') });
    const byKey = Object.fromEntries(zmanim.map((z) => [z.key, z]));
    const expected: Record<string, string> = {
      // Alot ha-Shachar
      alos90: '04:12:30',
      alos198: '04:12:34',
      alos18: '04:21:14',
      alosBaalHatanya: '04:26:30',
      alos72Zmanis: '04:29:40',
      alos60: '04:42:30',
      // Misheyakir
      misheyakir95: '05:01:40',
      misheyakir765: '05:10:25',
      // Sof zman Shma
      sofZmanShmaMGA90: '07:59:33',
      sofZmanShmaMGA18: '08:03:58',
      sofZmanShmaMGA161: '08:08:30',
      sofZmanShmaBaalHatanya: '08:42:48',
      // Sof zman Tefila
      sofZmanTfilaMGA90: '09:15:15',
      sofZmanTfilaMGA18: '09:18:12',
      sofZmanTfilaMGA161: '09:21:14',
      sofZmanTfilaBaalHatanya: '09:44:04',
      // Mincha Gedola
      minchaGedola30: '12:16:31',
      minchaGedolaBaalHatanya: '12:17:15',
      minchaGedola161: '12:23:03',
      // Mincha Ketana
      minchaKetanaBaalHatanya: '15:21:05',
      minchaKetana161: '16:01:13',
      // Plag ha-Mincha
      plagBaalHatanya: '16:37:40',
      // Tzeit ha-Kochavim
      tzaisGeonim645: '18:17:12',
      tzaisGeonim7083: '18:20:12',
      tzaisAteretTorah: '18:30:44',
      tzais50: '18:40:44',
      tzais60: '18:50:44',
      tzais161: '19:03:02',
      tzais72Zmanis: '19:03:34',
      tzais18: '19:12:10',
      tzais90: '19:20:44',
    };
    for (const [key, want] of Object.entries(expected)) {
      const zman = byKey[key];
      expect(zman, `missing zman ${key}`).toBeDefined();
      expect(zman.time ? zman.time.toFormat('HH:mm:ss') : null, key).toBe(want);
    }
  });
});
