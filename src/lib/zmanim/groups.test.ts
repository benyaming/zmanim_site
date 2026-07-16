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
  familyLabel: (f) => `fam:${f}`,
  familyDescription: (f) => `famDesc:${f}`,
  group: (c) => c,
};

const at = (hhmm: string) => DateTime.fromISO(`2024-06-01T${hhmm}`, { zone: 'Asia/Jerusalem' });

function zman(over: Partial<ComputedZman> & Pick<ComputedZman, 'key' | 'base' | 'category' | 'order'>): ComputedZman {
  return { method: 'getSunrise', family: 'solar', time: null, ...over } as ComputedZman;
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

  it('orders bases by their canonical position, not their earliest time', () => {
    // Alot is defined before Misheyakir (lower order), and must stay first even
    // when its earliest opinion falls LATER than Misheyakir's — as at Düsseldorf
    // midsummer, where Alot's steep degrees are null and its surviving times slip
    // behind the shallow-angle Misheyakir. The base sequence is conceptual (alot
    // is the start of dawn) and must not swap with the sun.
    const zmanim = [
      zman({ key: 'alosA', base: 'alos', category: 'dawn', order: 12, time: at('03:52') }),
      zman({ key: 'alosB', base: 'alos', category: 'dawn', order: 18, time: at('03:43') }),
      zman({ key: 'mish', base: 'misheyakir', category: 'dawn', order: 30, time: at('03:32') }),
    ];
    const [dawn] = buildZmanimGroups(zmanim, t);
    expect(dawn.items.map((i) => i.base)).toEqual(['alos', 'misheyakir']);
    // The base's canonical order is its smallest opinion order.
    expect(dawn.items.find((i) => i.base === 'alos')!.order).toBe(12);
  });

  it('still orders the OPINIONS inside a base by their actual time', () => {
    // Base ordering is canonical; row ordering inside a base stays chronological.
    const zmanim = [
      zman({ key: 'alosLate', base: 'alos', category: 'dawn', order: 10, time: at('04:07') }),
      zman({ key: 'alosEarly', base: 'alos', category: 'dawn', order: 12, time: at('03:46') }),
    ];
    const [dawn] = buildZmanimGroups(zmanim, t);
    expect(dawn.items[0].rows.map((r) => r.key)).toEqual(['alosEarly', 'alosLate']);
  });

  it('keeps all-null (duration) rows in stable definition order inside their base', () => {
    const zmanim = [
      zman({ key: 'shaahMGA', base: 'shaahZmanis', category: 'evening', order: 200, time: null, duration: true, durationMillis: 4_000_000 }),
      zman({ key: 'shaahGRA', base: 'shaahZmanis', category: 'evening', order: 202, time: null, duration: true, durationMillis: 3_600_000 }),
      zman({ key: 'tzaisEarly', base: 'tzais', category: 'evening', order: 160, time: at('20:20') }),
      zman({ key: 'tzaisLate', base: 'tzais', category: 'evening', order: 168, time: at('21:02') }),
    ];
    const [evening] = buildZmanimGroups(zmanim, t);
    // Bases by canonical order: tzais (160) before shaah zmanis (200).
    expect(evening.items.map((i) => i.base)).toEqual(['tzais', 'shaahZmanis']);
    // Both shaah-zmanis rows are null (time-less durations); a stable sort keeps
    // their definition order rather than reshuffling them.
    const shaah = evening.items.find((i) => i.base === 'shaahZmanis')!;
    expect(shaah.rows.map((r) => r.key)).toEqual(['shaahMGA', 'shaahGRA']);
  });

  it('keeps a single-opinion base using its own detail as the description', () => {
    const zmanim = [zman({ key: 'chatzos', base: 'chatzos', category: 'midday', order: 10, time: at('12:44') })];
    const [midday] = buildZmanimGroups(zmanim, t);
    expect(midday.items[0].description).toBe('detail:chatzos');
  });
});

describe('buildZmanimGroups family partition', () => {
  it('partitions a base into families in canonical order, rows chronological within each', () => {
    // Times chosen so the families INTERLEAVE: the fixed-72 dawn (04:10) falls
    // between the two degree rows. The partition must not let that reorder the
    // headings — families are a fixed ladder, not a timeline.
    const zmanim = [
      zman({ key: 'alos72Zmanis', base: 'alos', category: 'dawn', order: 10, family: 'seasonalMinutes', time: at('03:43') }),
      zman({ key: 'alos72', base: 'alos', category: 'dawn', order: 12, family: 'fixedMinutes', time: at('04:10') }),
      zman({ key: 'alos198', base: 'alos', category: 'dawn', order: 14, family: 'degrees', time: at('03:20') }),
      zman({ key: 'alos90', base: 'alos', category: 'dawn', order: 16, family: 'fixedMinutes', time: at('03:52') }),
      zman({ key: 'alosHashachar', base: 'alos', category: 'dawn', order: 18, family: 'degrees', time: at('04:30') }),
    ];
    const [dawn] = buildZmanimGroups(zmanim, t);
    const alos = dawn.items.find((i) => i.base === 'alos')!;
    expect(alos.families.map((f) => f.family)).toEqual(['degrees', 'fixedMinutes', 'seasonalMinutes']);
    expect(alos.families.map((f) => f.rows.map((r) => r.key))).toEqual([
      ['alos198', 'alosHashachar'],
      ['alos90', 'alos72'],
      ['alos72Zmanis'],
    ]);
    // The flat row list stays purely chronological, crossing families freely.
    expect(alos.rows.map((r) => r.key)).toEqual(['alos198', 'alos72Zmanis', 'alos90', 'alos72', 'alosHashachar']);
    expect(alos.families[0].label).toBe('fam:degrees');
    expect(alos.families[0].description).toBe('famDesc:degrees');
    // Two families (degrees, fixedMinutes) hold >1 opinion → worth grouping.
    expect(alos.grouped).toBe(true);
  });

  it('groups Sof zman Shma by day-definition even though every opinion is a day-fraction', () => {
    // The families here are the two day-definitions, not the arithmetic — the
    // axis that captures the Magen Avraham vs Vilna Gaon machloket.
    const zmanim = [
      zman({ key: 'sofZmanShmaMGA90', base: 'sofZmanShma', category: 'morning', order: 60, family: 'dawnToNightfall', time: at('07:59') }),
      zman({ key: 'sofZmanShmaMGA', base: 'sofZmanShma', category: 'morning', order: 66, family: 'dawnToNightfall', time: at('08:08') }),
      zman({ key: 'sofZmanShmaBaalHatanya', base: 'sofZmanShma', category: 'morning', order: 68, family: 'sunriseToSunset', time: at('08:42') }),
      zman({ key: 'sofZmanShmaGRA', base: 'sofZmanShma', category: 'morning', order: 70, family: 'sunriseToSunset', time: at('08:44') }),
    ];
    const [morning] = buildZmanimGroups(zmanim, t);
    const shma = morning.items[0];
    expect(shma.families.map((f) => f.family)).toEqual(['dawnToNightfall', 'sunriseToSunset']);
    expect(shma.grouped).toBe(true);
  });

  it('does NOT group when only one family has multiple opinions (Mincha Gedola)', () => {
    // fixedMinutes(1) + sunriseToSunset(2) + dawnToNightfall(1): three families,
    // but only one is multi-opinion, so the base stays flat.
    const zmanim = [
      zman({ key: 'minchaGedola30', base: 'minchaGedola', category: 'afternoon', order: 120, family: 'fixedMinutes', time: at('12:16') }),
      zman({ key: 'minchaGedola', base: 'minchaGedola', category: 'afternoon', order: 122, family: 'sunriseToSunset', time: at('12:17') }),
      zman({ key: 'minchaGedolaBaalHatanya', base: 'minchaGedola', category: 'afternoon', order: 124, family: 'sunriseToSunset', time: at('12:17') }),
      zman({ key: 'minchaGedola161', base: 'minchaGedola', category: 'afternoon', order: 126, family: 'dawnToNightfall', time: at('12:23') }),
    ];
    const [afternoon] = buildZmanimGroups(zmanim, t);
    expect(afternoon.items[0].families).toHaveLength(3);
    expect(afternoon.items[0].grouped).toBe(false);
  });

  it('gives a single-family base one group and does not mark it grouped', () => {
    const zmanim = [
      zman({ key: 'misheyakir115', base: 'misheyakir', category: 'dawn', order: 10, family: 'degrees', time: at('04:52') }),
      zman({ key: 'misheyakir102', base: 'misheyakir', category: 'dawn', order: 12, family: 'degrees', time: at('04:58') }),
    ];
    const [dawn] = buildZmanimGroups(zmanim, t);
    expect(dawn.items[0].families).toHaveLength(1);
    expect(dawn.items[0].grouped).toBe(false);
  });

  it('keeps a family whose every row is blank, so the gap can be explained', () => {
    // A short night: no degree dawn at all. The family must survive the
    // partition — dropping it would silently hide that the opinions exist.
    const zmanim = [
      zman({ key: 'alosHashachar', base: 'alos', category: 'dawn', order: 10, family: 'degrees', time: null }),
      zman({ key: 'alos18', base: 'alos', category: 'dawn', order: 12, family: 'degrees', time: null }),
      zman({ key: 'alos72', base: 'alos', category: 'dawn', order: 14, family: 'fixedMinutes', time: at('04:10') }),
    ];
    const [dawn] = buildZmanimGroups(zmanim, t);
    const alos = dawn.items.find((i) => i.base === 'alos')!;
    expect(alos.families.map((f) => f.family)).toEqual(['degrees', 'fixedMinutes']);
    expect(alos.families[0].rows.every((r) => !r.time)).toBe(true);
    // Only the degrees family is multi-opinion → flat, blank explained per family.
    expect(alos.grouped).toBe(false);
  });
});
