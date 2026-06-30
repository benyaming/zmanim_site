import { ComplexZmanimCalendar } from 'kosher-zmanim';
import { describe, expect, it } from 'vitest';

import { ZMANIM } from './definitions';

describe('ZMANIM definitions integrity', () => {
  it('maps every label to a real ComplexZmanimCalendar method', () => {
    const proto = ComplexZmanimCalendar.prototype as unknown as Record<string, unknown>;
    for (const def of ZMANIM) {
      expect(typeof proto[def.method], `${def.key} -> ${def.method}`).toBe('function');
    }
  });

  it('has unique keys', () => {
    const keys = ZMANIM.map((z) => z.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has strictly increasing order values', () => {
    const orders = ZMANIM.map((z) => z.order);
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i], `order at index ${i}`).toBeGreaterThan(orders[i - 1]);
    }
  });

  /**
   * LOCKED MAPPING. This is the guardrail against the legacy bug where a zman
   * was displayed under the wrong name. Any change here must be a deliberate,
   * reviewed edit — never an accident.
   */
  it('locks the exact key -> method mapping', () => {
    const mapping = Object.fromEntries(ZMANIM.map((z) => [z.key, z.method]));
    expect(mapping).toEqual({
      alosHashachar: 'getAlosHashachar',
      alos72: 'getAlos72',
      misheyakir115: 'getMisheyakir11Point5Degrees',
      misheyakir11: 'getMisheyakir11Degrees',
      misheyakir102: 'getMisheyakir10Point2Degrees',
      sunrise: 'getSunrise',
      sofZmanShmaMGA: 'getSofZmanShmaMGA',
      sofZmanShmaGRA: 'getSofZmanShmaGRA',
      sofZmanTfilaMGA: 'getSofZmanTfilaMGA',
      sofZmanTfilaGRA: 'getSofZmanTfilaGRA',
      chatzos: 'getChatzos',
      minchaGedola: 'getMinchaGedola',
      minchaKetana: 'getMinchaKetana',
      plagHamincha: 'getPlagHamincha',
      candleLighting: 'getCandleLighting',
      sunset: 'getSunset',
      tzaisGeonim: 'getTzaisGeonim5Point95Degrees',
      tzais: 'getTzais',
      tzais42: 'getSunset',
      tzais72: 'getTzais72',
      chatzosLaila: 'getSolarMidnight',
    });
  });

  it('locks the fixed-minute offsets (e.g. tzeit 42 = sunset + 42)', () => {
    const offsets = Object.fromEntries(
      ZMANIM.filter((z) => z.offsetMinutes != null).map((z) => [z.key, z.offsetMinutes]),
    );
    expect(offsets).toEqual({ tzais42: 42 });
  });

  it('marks candle lighting as the only erev-only zman', () => {
    const erevOnly = ZMANIM.filter((z) => z.erevOnly).map((z) => z.key);
    expect(erevOnly).toEqual(['candleLighting']);
  });
});
