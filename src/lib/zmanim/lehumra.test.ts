import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { computeZmanim } from './calculator';
import { ZMANIM } from './definitions';
import { applyLehumra, applyLehumraToEvents, roundTimeLehumra, zmanLehumraDirection } from './lehumra';

const JERUSALEM = { lat: 31.778, lng: 35.235, timeZoneId: 'Asia/Jerusalem' };

/**
 * The locked direction for every zman key. Deadlines round down, onsets round
 * up — mirrors zmanim_bot's LEHUMRA_MINUS_MINUTE_NAMES. Adding a zman without
 * classifying it here fails the completeness check below.
 */
const EXPECTED_DIRECTIONS: Record<string, 'earlier' | 'later'> = {
  // Dawn — onsets
  alos90: 'later',
  alos198: 'later',
  alos18: 'later',
  alosBaalHatanya: 'later',
  alos72Zmanis: 'later',
  alosHashachar: 'later',
  alos72: 'later',
  alos60: 'later',
  misheyakir115: 'later',
  misheyakir11: 'later',
  misheyakir102: 'later',
  misheyakir95: 'later',
  misheyakir765: 'later',
  // Morning — sunrise onset; Sof zman Shma/Tfila deadlines
  sunrise: 'later',
  sofZmanShmaMGA90: 'earlier',
  sofZmanShmaMGA18: 'earlier',
  sofZmanShmaMGA161: 'earlier',
  sofZmanShmaMGA: 'earlier',
  sofZmanShmaBaalHatanya: 'earlier',
  sofZmanShmaGRA: 'earlier',
  sofZmanTfilaMGA90: 'earlier',
  sofZmanTfilaMGA18: 'earlier',
  sofZmanTfilaMGA161: 'earlier',
  sofZmanTfilaMGA: 'earlier',
  sofZmanTfilaBaalHatanya: 'earlier',
  sofZmanTfilaGRA: 'earlier',
  sofZmanAchilasChametzMGA: 'earlier',
  sofZmanAchilasChametzGRA: 'earlier',
  sofZmanBiurChametzMGA: 'earlier',
  sofZmanBiurChametzGRA: 'earlier',
  // Midday
  chatzos: 'later',
  // Afternoon — Mincha / Plag onsets
  minchaGedola30: 'later',
  minchaGedola: 'later',
  minchaGedolaBaalHatanya: 'later',
  minchaGedola161: 'later',
  minchaKetana: 'later',
  minchaKetanaBaalHatanya: 'later',
  minchaKetana161: 'later',
  plagHamincha: 'later',
  plagBaalHatanya: 'later',
  // Evening — candle/sunset deadlines; nightfall onsets
  candleLighting: 'earlier',
  sunset: 'earlier',
  tzaisGeonim: 'later',
  tzaisGeonim645: 'later',
  tzaisGeonim7083: 'later',
  tzais: 'later',
  tzaisAteretTorah: 'later',
  tzais42: 'later',
  tzais50: 'later',
  tzais60: 'later',
  tzais72: 'later',
  tzais161: 'later',
  tzais72Zmanis: 'later',
  tzais18: 'later',
  tzais90: 'later',
  chatzosLaila: 'later',
};

describe('zmanLehumraDirection', () => {
  it('classifies every defined zman, and exactly as pinned', () => {
    for (const def of ZMANIM) {
      // Duration zmanim (shaah zmanis) carry a length, not a clock time —
      // there is nothing for lehumra to round, so they are exempt.
      if (def.duration) continue;
      expect(EXPECTED_DIRECTIONS[def.key], `missing expectation for ${def.key}`).toBeDefined();
      expect(zmanLehumraDirection(def.key), def.key).toBe(EXPECTED_DIRECTIONS[def.key]);
    }
    // No stale expectations for removed zmanim.
    const keys = new Set(ZMANIM.map((z) => z.key));
    for (const key of Object.keys(EXPECTED_DIRECTIONS)) {
      expect(keys.has(key), `stale expectation for ${key}`).toBe(true);
    }
  });
});

describe('roundTimeLehumra', () => {
  const t = DateTime.fromISO('2026-07-05T09:23:45.500', { zone: 'Asia/Jerusalem' });

  it('rounds down for deadlines', () => {
    expect(roundTimeLehumra(t, 'earlier').toISO()).toBe(t.startOf('minute').toISO());
  });

  it('rounds up for onsets', () => {
    expect(roundTimeLehumra(t, 'later').toISO()).toBe(t.startOf('minute').plus({ minutes: 1 }).toISO());
  });

  it('leaves an exact whole minute unchanged in both directions', () => {
    const exact = DateTime.fromISO('2026-07-05T09:23:00.000', { zone: 'Asia/Jerusalem' });
    expect(roundTimeLehumra(exact, 'earlier').toISO()).toBe(exact.toISO());
    expect(roundTimeLehumra(exact, 'later').toISO()).toBe(exact.toISO());
  });

  it('passes null through', () => {
    expect(roundTimeLehumra(null, 'earlier')).toBeNull();
    expect(roundTimeLehumra(null, 'later')).toBeNull();
  });
});

describe('applyLehumra', () => {
  const zmanim = computeZmanim({ ...JERUSALEM, date: DateTime.fromISO('2026-07-05') });
  const rounded = applyLehumra(zmanim);

  it('is never lenient: rounded time is on the strict side of the exact time, within a minute', () => {
    for (const [i, z] of rounded.entries()) {
      const raw = zmanim[i].time;
      if (!raw || !z.time) continue;
      const diff = z.time.toMillis() - raw.toMillis();
      if (zmanLehumraDirection(z.key) === 'earlier') {
        expect(diff, z.key).toBeLessThanOrEqual(0);
        expect(diff, z.key).toBeGreaterThan(-60_000);
      } else {
        expect(diff, z.key).toBeGreaterThanOrEqual(0);
        expect(diff, z.key).toBeLessThan(60_000);
      }
      expect(z.time.second, z.key).toBe(0);
      expect(z.time.millisecond, z.key).toBe(0);
    }
  });

  it('keeps the raw computation untouched (display-only transform)', () => {
    const again = computeZmanim({ ...JERUSALEM, date: DateTime.fromISO('2026-07-05') });
    for (const [i, z] of zmanim.entries()) {
      expect(z.time?.toISO()).toBe(again[i].time?.toISO());
    }
  });
});

describe('applyLehumraToEvents', () => {
  const time = DateTime.fromISO('2026-07-05T19:45:30', { zone: 'Asia/Jerusalem' });

  it('rounds candle lighting and fast start down, havdalah and fast end up', () => {
    const events = applyLehumraToEvents([
      { type: 'candle', time },
      { type: 'fastStart', time },
      { type: 'havdalah', time },
      { type: 'fastEnd', time },
    ]);
    expect(events[0].time?.toFormat('HH:mm:ss')).toBe('19:45:00');
    expect(events[1].time?.toFormat('HH:mm:ss')).toBe('19:45:00');
    expect(events[2].time?.toFormat('HH:mm:ss')).toBe('19:46:00');
    expect(events[3].time?.toFormat('HH:mm:ss')).toBe('19:46:00');
  });

  it('rounds an after-nightfall candle lighting (2nd night / Motzei Shabbat) up', () => {
    const [e] = applyLehumraToEvents([{ type: 'candle', time, afterNightfall: true }]);
    expect(e.time?.toFormat('HH:mm:ss')).toBe('19:46:00');
  });

  it('passes null times through', () => {
    expect(applyLehumraToEvents([{ type: 'havdalah', time: null }])[0].time).toBeNull();
  });
});
