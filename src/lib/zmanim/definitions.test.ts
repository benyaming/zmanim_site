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
      // Dawn — Alot ha-Shachar
      alos90: 'getAlos90',
      alos198: 'getAlos19Point8Degrees',
      alos18: 'getAlos18Degrees',
      alosBaalHatanya: 'getAlosBaalHatanya',
      alos72Zmanis: 'getAlos72Zmanis',
      alosHashachar: 'getAlosHashachar',
      alos72: 'getAlos72',
      alos60: 'getAlos60',
      // Dawn — Misheyakir
      misheyakir115: 'getMisheyakir11Point5Degrees',
      misheyakir11: 'getMisheyakir11Degrees',
      misheyakir102: 'getMisheyakir10Point2Degrees',
      misheyakir95: 'getMisheyakir9Point5Degrees',
      misheyakir765: 'getMisheyakir7Point65Degrees',
      // Morning
      sunrise: 'getSunrise',
      sofZmanShmaMGA90: 'getSofZmanShmaMGA90Minutes',
      sofZmanShmaMGA18: 'getSofZmanShmaMGA18Degrees',
      sofZmanShmaMGA161: 'getSofZmanShmaMGA16Point1Degrees',
      sofZmanShmaMGA: 'getSofZmanShmaMGA',
      sofZmanShmaBaalHatanya: 'getSofZmanShmaBaalHatanya',
      sofZmanShmaGRA: 'getSofZmanShmaGRA',
      sofZmanTfilaMGA90: 'getSofZmanTfilaMGA90Minutes',
      sofZmanTfilaMGA18: 'getSofZmanTfilaMGA18Degrees',
      sofZmanTfilaMGA161: 'getSofZmanTfilaMGA16Point1Degrees',
      sofZmanTfilaMGA: 'getSofZmanTfilaMGA',
      sofZmanTfilaBaalHatanya: 'getSofZmanTfilaBaalHatanya',
      sofZmanTfilaGRA: 'getSofZmanTfilaGRA',
      sofZmanAchilasChametzMGA: 'getSofZmanAchilasChametzMGA72Minutes',
      sofZmanAchilasChametzGRA: 'getSofZmanAchilasChametzGRA',
      sofZmanBiurChametzMGA: 'getSofZmanBiurChametzMGA72Minutes',
      sofZmanBiurChametzGRA: 'getSofZmanBiurChametzGRA',
      // Midday
      chatzos: 'getChatzos',
      // Afternoon
      minchaGedola30: 'getMinchaGedola30Minutes',
      minchaGedola: 'getMinchaGedola',
      minchaGedolaBaalHatanya: 'getMinchaGedolaBaalHatanya',
      minchaGedola161: 'getMinchaGedola16Point1Degrees',
      minchaKetana: 'getMinchaKetana',
      minchaKetanaBaalHatanya: 'getMinchaKetanaBaalHatanya',
      minchaKetana161: 'getMinchaKetana16Point1Degrees',
      plagHamincha: 'getPlagHamincha',
      plagBaalHatanya: 'getPlagHaminchaBaalHatanya',
      // Evening & night
      candleLighting: 'getCandleLighting',
      sunset: 'getSunset',
      tzaisGeonim: 'getTzaisGeonim5Point95Degrees',
      tzaisGeonim645: 'getTzaisGeonim6Point45Degrees',
      tzaisGeonim7083: 'getTzaisGeonim7Point083Degrees',
      tzais: 'getTzais',
      tzaisAteretTorah: 'getTzaisAteretTorah',
      tzais42: 'getSunset',
      tzais50: 'getTzais50',
      tzais60: 'getTzais60',
      tzais72: 'getTzais72',
      tzais161: 'getTzais16Point1Degrees',
      tzais72Zmanis: 'getTzais72Zmanis',
      tzais18: 'getTzais18Degrees',
      tzais90: 'getTzais90',
      chatzosLaila: 'getSolarMidnight',
      shaahZmanisMGA: 'getShaahZmanisMGA',
      shaahZmanisGRA: 'getShaahZmanisGra',
    });
  });

  it('marks exactly the astronomical hours as durations', () => {
    const durations = ZMANIM.filter((z) => z.duration).map((z) => z.key);
    expect(durations).toEqual(['shaahZmanisMGA', 'shaahZmanisGRA']);
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

  it('marks exactly the chametz deadlines as Erev Pesach-only', () => {
    const erevPesachOnly = ZMANIM.filter((z) => z.erevPesachOnly).map((z) => z.key);
    expect(erevPesachOnly).toEqual([
      'sofZmanAchilasChametzMGA',
      'sofZmanAchilasChametzGRA',
      'sofZmanBiurChametzMGA',
      'sofZmanBiurChametzGRA',
    ]);
  });
});
