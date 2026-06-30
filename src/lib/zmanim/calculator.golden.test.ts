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

  it('renders in the location timezone, independent of the host timezone', () => {
    const zmanim = computeZmanim({ lat: 31.778, lng: 35.2354, date: DateTime.fromISO('2024-03-20') });
    const sunrise = zmanim.find((z) => z.key === 'sunrise')!;
    expect(sunrise.time!.zoneName).toBe('Asia/Jerusalem');
  });
});
