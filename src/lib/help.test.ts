import { describe, expect, it } from 'vitest';

import { HELP, type HelpLocale } from './help';
import {
  anchorZmanim,
  EQUINOX_ANCHOR,
  EQUINOX_PAIRS,
  gapSeconds,
  SHORT_NIGHT_ANCHOR,
  SHORT_NIGHT_KEYS,
} from './help-examples';
import { ZMANIM } from './zmanim';

const LOCALES: HelpLocale[] = ['en', 'he', 'ru'];

describe('help document', () => {
  it('exists in every locale with the same sections in the same order', () => {
    const ids = (locale: HelpLocale) => HELP[locale].sections.map((s) => s.id);
    for (const locale of LOCALES) {
      expect(HELP[locale]).toBeDefined();
      expect(ids(locale)).toEqual(ids('en'));
    }
  });

  it('has the same shape in every locale', () => {
    // A locale silently missing a paragraph or a term is the failure mode here:
    // the translations must say the same things, not merely all be present.
    const shape = (locale: HelpLocale) =>
      HELP[locale].sections.map((s) => ({
        body: s.body.length,
        terms: s.terms?.length ?? 0,
        generated: s.generated ?? null,
      }));
    for (const locale of LOCALES) expect(shape(locale)).toEqual(shape('en'));
  });

  it('has no empty title, heading, paragraph or term', () => {
    for (const locale of LOCALES) {
      const { title, lede, sections } = HELP[locale];
      expect(title.trim()).not.toBe('');
      expect(lede.trim()).not.toBe('');
      expect(sections.length).toBeGreaterThan(0);
      for (const section of sections) {
        expect(section.heading.trim()).not.toBe('');
        for (const paragraph of section.body) expect(paragraph.trim()).not.toBe('');
        for (const term of section.terms ?? []) {
          expect(term.term.trim()).not.toBe('');
          expect(term.body.trim()).not.toBe('');
        }
        // Every section must carry SOMETHING — prose, a term list or a
        // generated block. An id with an empty body is a drafting slip.
        expect(section.body.length + (section.terms?.length ?? 0) + (section.generated ? 1 : 0)).toBeGreaterThan(0);
      }
    }
  });

  it('uses unique anchor ids', () => {
    const ids = HELP.en.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('help examples', () => {
  it('references only real zman keys', () => {
    const known = new Set(ZMANIM.map((z) => z.key));
    for (const pair of EQUINOX_PAIRS) {
      expect(known).toContain(pair.degrees);
      expect(known).toContain(pair.minutes);
    }
    for (const key of SHORT_NIGHT_KEYS) expect(known).toContain(key);
  });

  it('pairs a degree opinion with a fixed-minute one', () => {
    const family = (key: string) => ZMANIM.find((z) => z.key === key)?.family;
    for (const pair of EQUINOX_PAIRS) {
      expect(family(pair.degrees)).toBe('degrees');
      expect(family(pair.minutes)).toBe('fixedMinutes');
    }
  });

  /**
   * The whole point of the equinox table: at this anchor the degree opinion and
   * the fixed-minute opinion that names it land within a minute of each other.
   * If a definition change broke that, the section's prose ("each pair is
   * seconds apart") would be false — so it fails here rather than on the page.
   */
  it('shows degree and minute opinions coinciding at the equinox anchor', () => {
    const keys = EQUINOX_PAIRS.flatMap((p) => [p.degrees, p.minutes]);
    const times = anchorZmanim(EQUINOX_ANCHOR, keys);
    for (const pair of EQUINOX_PAIRS) {
      const gap = gapSeconds(times.get(pair.degrees) ?? null, times.get(pair.minutes) ?? null);
      expect(gap).not.toBeNull();
      expect(gap!).toBeLessThan(60);
    }
  });

  /**
   * And the point of the short-night table: the degree dawns have no time while
   * the minute-based ones do, and the seasonal dawn precedes the fixed-90 one —
   * the inversion the section describes.
   */
  it('shows degree opinions blank and minute opinions resolved on a short night', () => {
    const times = anchorZmanim(SHORT_NIGHT_ANCHOR, SHORT_NIGHT_KEYS);
    for (const key of ['alos198', 'alos18', 'alosHashachar']) expect(times.get(key)).toBeNull();
    // Not `toBeInstanceOf(DateTime)`: kosher-zmanim bundles its own luxon copy,
    // so a returned DateTime is a different class identity than the one imported
    // here even though it is a perfectly valid DateTime.
    for (const key of ['alos90', 'alos72', 'alos72Zmanis']) expect(times.get(key)?.isValid).toBe(true);
    expect(times.get('alos72Zmanis')!.toMillis()).toBeLessThan(times.get('alos90')!.toMillis());
  });
});
