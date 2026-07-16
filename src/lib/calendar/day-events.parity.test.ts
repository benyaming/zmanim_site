import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { computeZmanim, DEFAULT_HAVDALAH_OPINION, HAVDALAH_OPINIONS, havdalahTime, havdalahZmanKey } from '@/lib/zmanim';

import { dayEventZmanKeys, getDayEvents } from './day-events';

/**
 * The grid and exports compute only `dayEventZmanKeys(...)` instead of every
 * opinion (a big perf win). This pins that the subset yields byte-identical
 * events to a full computeZmanim — so the optimization can never silently drop
 * a fast-end / havdalah / candle time if a new opinion is added.
 */
const LOC = { lat: 31.778, lng: 35.2354, timeZoneId: 'Asia/Jerusalem' };

function eventsFor(date: DateTime, havdalah: (typeof HAVDALAH_OPINIONS)[number], keys?: Iterable<string>) {
  const z = computeZmanim({ ...LOC, date, keys });
  const byKey = Object.fromEntries(z.map((x) => [x.key, x.time]));
  return getDayEvents(
    date,
    {
      candleLighting: byKey.candleLighting,
      sunset: byKey.sunset,
      havdalah: havdalahTime(havdalah, byKey),
      zmanimByKey: byKey,
    },
    true, // Israel
    [], // show every fast-end opinion, exercising all the keys
  );
}

const fmt = (e: { type: string; zmanKey?: string; time: DateTime | null; afterNightfall?: boolean }) =>
  `${e.type}:${e.zmanKey ?? ''}:${e.time?.toISO() ?? 'null'}:${e.afterNightfall ?? false}`;

describe('day-events parity: dayEventZmanKeys subset vs full compute', () => {
  const DATES = [
    '2024-07-23', // 17 Tammuz — minor fast (both fast-end groups)
    '2024-08-13', // Tisha B'Av — major fast (nightfall only)
    '2024-03-22', // Erev Shabbat — candle lighting
    '2024-03-23', // Motzei Shabbat — havdalah
    '2024-10-12', // Yom Kippur — havdalah, no fast-end
  ];
  for (const opinion of HAVDALAH_OPINIONS) {
    for (const iso of DATES) {
      it(`${iso} · ${opinion}`, () => {
        const date = DateTime.fromISO(iso);
        const full = eventsFor(date, opinion);
        const subset = eventsFor(date, opinion, dayEventZmanKeys(havdalahZmanKey(opinion)));
        expect(subset.map(fmt)).toEqual(full.map(fmt));
      });
    }
  }

  it('default opinion set covers the event keys for every havdalah choice', () => {
    // Sanity: each havdalah opinion's zman key is included in its event-key set.
    for (const opinion of HAVDALAH_OPINIONS) {
      expect(dayEventZmanKeys(havdalahZmanKey(opinion)).has(havdalahZmanKey(opinion))).toBe(true);
    }
    expect(dayEventZmanKeys(havdalahZmanKey(DEFAULT_HAVDALAH_OPINION)).has('sunset')).toBe(true);
  });
});
