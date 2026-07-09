import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { buildZmanimGroups } from './groups';
import type { ComputedZman, ZmanTranslators } from './index';

// Identity translator: labels are just the keys, so assertions read clearly.
const t: ZmanTranslators = {
  name: (k) => k,
  shita: (k) => k,
  detail: (k) => `detail:${k}`,
  baseDescription: (b) => `base:${b}`,
  group: (c) => c,
};

const at = (hhmm: string) => DateTime.fromISO(`2024-06-01T${hhmm}`, { zone: 'Asia/Jerusalem' });

function zman(over: Partial<ComputedZman> & Pick<ComputedZman, 'key' | 'base' | 'category' | 'order'>): ComputedZman {
  return { method: 'getSunrise', time: null, ...over } as ComputedZman;
}

describe('buildZmanimGroups ordering', () => {
  it('sorts the shitot within a base by actual time, not definition order', () => {
    // Definition order (by `order`) deliberately does NOT match the times.
    const zmanim = [
      zman({ key: 'alosFixed90', base: 'alos', category: 'dawn', order: 10, time: at('04:07') }),
      zman({ key: 'alosDeg', base: 'alos', category: 'dawn', order: 12, time: at('03:46') }),
      zman({ key: 'alos18', base: 'alos', category: 'dawn', order: 14, time: at('03:57') }),
      zman({ key: 'alos60', base: 'alos', category: 'dawn', order: 16, time: at('04:37') }),
    ];
    const [dawn] = buildZmanimGroups(zmanim, t);
    const alos = dawn.items.find((i) => i.base === 'alos')!;
    expect(alos.rows.map((r) => r.key)).toEqual(['alosDeg', 'alos18', 'alosFixed90', 'alos60']);
  });

  it('orders bases within a section by their earliest time', () => {
    const zmanim = [
      // Misheyakir defined before Alos, but Alos is earlier — Alos must come first.
      zman({ key: 'mish', base: 'misheyakir', category: 'dawn', order: 10, time: at('04:40') }),
      zman({ key: 'alosA', base: 'alos', category: 'dawn', order: 20, time: at('04:30') }),
      zman({ key: 'alosB', base: 'alos', category: 'dawn', order: 22, time: at('03:50') }),
    ];
    const [dawn] = buildZmanimGroups(zmanim, t);
    expect(dawn.items.map((i) => i.base)).toEqual(['alos', 'misheyakir']);
  });

  it('sorts null-time / duration rows last, keeping their definition order (stable)', () => {
    const zmanim = [
      zman({ key: 'shaahMGA', base: 'shaahZmanis', category: 'evening', order: 10, time: null, duration: true, durationMillis: 4_000_000 }),
      zman({ key: 'shaahGRA', base: 'shaahZmanis', category: 'evening', order: 12, time: null, duration: true, durationMillis: 3_600_000 }),
      zman({ key: 'tzaisEarly', base: 'tzais', category: 'evening', order: 20, time: at('20:20') }),
      zman({ key: 'tzaisLate', base: 'tzais', category: 'evening', order: 22, time: at('21:02') }),
    ];
    const [evening] = buildZmanimGroups(zmanim, t);
    // Real-time base (tzais) before the duration base (all null → last).
    expect(evening.items.map((i) => i.base)).toEqual(['tzais', 'shaahZmanis']);
    const shaah = evening.items.find((i) => i.base === 'shaahZmanis')!;
    expect(shaah.rows.map((r) => r.key)).toEqual(['shaahMGA', 'shaahGRA']);
  });

  it('keeps a single-opinion base using its own detail as the description', () => {
    const zmanim = [zman({ key: 'chatzos', base: 'chatzos', category: 'midday', order: 10, time: at('12:44') })];
    const [midday] = buildZmanimGroups(zmanim, t);
    expect(midday.items[0].description).toBe('detail:chatzos');
  });
});
