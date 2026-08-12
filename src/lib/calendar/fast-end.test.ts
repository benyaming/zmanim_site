import { describe, expect, it } from 'vitest';

import en from '@/../messages/en.json';
import he from '@/../messages/he.json';
import ru from '@/../messages/ru.json';
import { ZMANIM } from '@/lib/zmanim';

import { DEFAULT_HIDDEN_FAST_END, FAST_END_OPINIONS, fastEndZmanKey, sanitizeHiddenFastEnd } from './fast-end';

const CATALOGS = { en, he, ru } as const;
type Loc = keyof typeof CATALOGS;
const LOCALES = Object.keys(CATALOGS) as Loc[];

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

/**
 * Fast-end opinions are labelled from the zmanim catalog, not from strings of
 * their own. They used to keep a parallel `events.fastEndOpinions` block, which
 * drifted the moment the shitot were rewritten: the panel said
 * "Рабейну Там · 72 минуты" while the fast rows still said
 * "Рабейну Там · 72 мин фикс." for the same nightfall.
 */
describe('fast-end labels come from the canonical register', () => {
  it('maps every opinion to a real zman key', () => {
    const known = new Set(ZMANIM.map((z) => z.key));
    for (const o of FAST_END_OPINIONS) {
      expect(fastEndZmanKey(o.key), o.key).toBe(o.zmanKey);
      expect(known, o.key).toContain(fastEndZmanKey(o.key));
    }
  });

  it.each(LOCALES)('%s labels every opinion through zmanim.shitot', (loc) => {
    const shitot = (CATALOGS[loc].zmanim as unknown as Record<string, Record<string, string>>).shitot;
    for (const o of FAST_END_OPINIONS) {
      const label = shitot[fastEndZmanKey(o.key)];
      expect(label, `${loc}: ${o.key}`).toBeTypeOf('string');
      expect(label!.trim(), `${loc}: ${o.key}`).not.toBe('');
    }
  });

  it.each(LOCALES)('%s keeps no parallel fast-end label block', (loc) => {
    const events = (CATALOGS[loc] as unknown as Record<string, Record<string, unknown>>).events;
    expect(events.fastEndOpinions, `${loc}: events.fastEndOpinions must not come back`).toBeUndefined();
  });
});
