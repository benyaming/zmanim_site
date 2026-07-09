import { describe, expect, it } from 'vitest';

import { DEFAULT_HIDDEN_FAST_END, FAST_END_OPINIONS, fastEndOpinionsFor, sanitizeHiddenFastEnd } from './fast-end';

describe('FAST_END_OPINIONS catalog', () => {
  it('has unique keys and strictly increasing order', () => {
    const keys = FAST_END_OPINIONS.map((o) => o.key);
    expect(new Set(keys).size).toBe(keys.length);
    const orders = FAST_END_OPINIONS.map((o) => o.order);
    for (let i = 1; i < orders.length; i++) expect(orders[i]).toBeGreaterThan(orders[i - 1]);
  });

  it('gives every opinion a computed-zman time source', () => {
    for (const o of FAST_END_OPINIONS) expect(typeof o.zmanKey, o.key).toBe('string');
  });

  it('locks the exact opinion set, grouped by severity (degree-based, attributed to poskim)', () => {
    const byKind = (kind: string) => FAST_END_OPINIONS.filter((o) => o.kind === kind).map((o) => o.key);
    // Gmar taanis (three medium stars) — Baal HaTanya 5.95° / Tukachinsky 6.45° / R' Moshe 7.083°.
    expect(byKind('gmarTaanis')).toEqual(['tzaisGeonim', 'tzaisGeonim645', 'tzaisGeonim7083']);
    // Nightfall (three small stars) — all fasts, incl. Tisha b'Av.
    expect(byKind('nightfall')).toEqual(['tzais', 'tzais42', 'tzais72']);
  });
});

describe('fastEndOpinionsFor', () => {
  it('offers both groups for a minor fast, nightfall only for a major fast', () => {
    expect(fastEndOpinionsFor(false)).toEqual(FAST_END_OPINIONS);
    const major = fastEndOpinionsFor(true);
    expect(major.every((o) => o.kind === 'nightfall')).toBe(true);
    expect(major.map((o) => o.key)).toEqual(['tzais', 'tzais42', 'tzais72']);
  });
});

describe('DEFAULT_HIDDEN_FAST_END', () => {
  it('leaves three distinct opinions visible — Geonim 5.95°, medium-stars 7.083°, small-stars 8.5°', () => {
    const hidden = new Set(DEFAULT_HIDDEN_FAST_END);
    const visible = FAST_END_OPINIONS.filter((o) => !hidden.has(o.key)).map((o) => o.key);
    expect(visible).toEqual(['tzaisGeonim', 'tzaisGeonim7083', 'tzais']);
  });
});

describe('sanitizeHiddenFastEnd', () => {
  it('keeps known keys, drops unknown/non-string, and dedups', () => {
    expect(sanitizeHiddenFastEnd(['tzais', 'tzais42', 'nope', 42, 'tzais'])).toEqual(['tzais', 'tzais42']);
  });

  it('returns [] for non-arrays', () => {
    expect(sanitizeHiddenFastEnd('tzais')).toEqual([]);
    expect(sanitizeHiddenFastEnd(null)).toEqual([]);
    expect(sanitizeHiddenFastEnd(undefined)).toEqual([]);
  });
});
