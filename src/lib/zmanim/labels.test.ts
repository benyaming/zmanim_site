import { describe, expect, it } from 'vitest';

import en from '@/../messages/en.json';
import he from '@/../messages/he.json';
import ru from '@/../messages/ru.json';

import { ZMANIM } from './definitions';
import { type LabelTranslator, zmanLabels, zmanNameShortForKey } from './labels';

const CATALOGS = { en, he, ru } as const;
type Loc = keyof typeof CATALOGS;
const LOCALES = Object.keys(CATALOGS) as Loc[];

/** Minimal stand-in for a next-intl translator over dotted paths. */
function translator(loc: Loc): LabelTranslator {
  const read = (key: string): unknown =>
    key.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], CATALOGS[loc]);
  const tr = ((key: string) => {
    const value = read(key);
    if (typeof value !== 'string') throw new Error(`missing message ${loc}:${key}`);
    return value;
  }) as LabelTranslator;
  tr.has = (key: string) => typeof read(key) === 'string';
  return tr;
}

const BASES = [...new Set(ZMANIM.map((z) => z.base))];

/** The label dictionaries, loosely typed — `zmanim` also holds plain strings. */
type Dict = Record<string, string | undefined>;
type Registers = {
  /** Mandatory registers. */
  names: Dict;
  shitot: Dict;
  /** Sparse override registers — absent entirely is legal. */
  shitotShort?: Dict;
  namesShort?: Dict;
  abbr?: Dict;
} & Record<string, Dict | undefined>;

describe('zman label catalogs', () => {
  it.each(LOCALES)('%s has a canonical name and shita for every zman', (loc) => {
    const z = CATALOGS[loc].zmanim as unknown as Registers;
    for (const def of ZMANIM) {
      expect(z.names[def.key], `names.${def.key}`).toBeTypeOf('string');
      expect(z.names[def.key]!.trim()).not.toBe('');
      // A shita label MAY be empty — a base with one opinion (sunrise, chatzos)
      // has nothing to distinguish — but the key must exist.
      expect(z.shitot[def.key], `shitot.${def.key}`).toBeTypeOf('string');
    }
  });

  it.each(LOCALES)('%s short registers are sparse overrides, never orphans', (loc) => {
    const z = CATALOGS[loc].zmanim as unknown as Registers;
    const keys = new Set(ZMANIM.map((d) => d.key));
    const bases = new Set(BASES);
    // Every override must refer to something real, so a renamed zman can't
    // leave a short label pointing at nothing.
    for (const key of Object.keys(z.shitotShort ?? {})) expect(keys, `shitotShort.${key}`).toContain(key);
    for (const base of Object.keys(z.namesShort ?? {})) expect(bases, `namesShort.${base}`).toContain(base);
    for (const base of Object.keys(z.abbr ?? {})) expect(bases, `abbr.${base}`).toContain(base);
  });

  /**
   * Overrides are per-locale by design: a language that has no accepted short
   * form for an authority simply omits the entry and falls back to the full
   * label. What must hold is that a "short" form is never LONGER than what it
   * replaces — that would be a copy/paste slip, not a decision.
   */
  it.each(LOCALES)('%s never overrides a label with a longer one', (loc) => {
    const z = CATALOGS[loc].zmanim as unknown as Registers;
    for (const [key, short] of Object.entries(z.shitotShort ?? {})) {
      expect(short!.length, `shitotShort.${key}`).toBeLessThanOrEqual(z.shitot[key]!.length);
    }
  });

  /**
   * Russian spells authorities out rather than carrying the Hebrew-style
   * acronym: a reader of the Russian catalog is not expected to expand ГР״А.
   * The Vilna Gaon rows therefore have no short override at all and resolve to
   * the full label through the fallback.
   */
  it('russian never abbreviates the Vilna Gaon', () => {
    const z = CATALOGS.ru.zmanim as unknown as Registers;
    for (const register of ['shitot', 'shitotShort'] as const) {
      for (const [key, label] of Object.entries(z[register] ?? {})) {
        expect(label, `ru.${register}.${key}`).not.toMatch(/ГР/);
      }
    }
    expect(zmanLabels(translator('ru')).shitaShort('sofZmanShmaGRA')).toBe('Виленский Гаон');
  });

  /**
   * The old arrangement kept three complete parallel dictionaries and they
   * drifted: `shitot.alos198` still read "90 min as degrees" while the short
   * form had long since been corrected to "19.8°". A degree opinion must state
   * its angle, not the minute figure it is nicknamed after.
   */
  it.each(LOCALES)('%s labels a degree opinion with its angle', (loc) => {
    const z = CATALOGS[loc].zmanim as unknown as Registers;
    const ANGLES: Record<string, string> = {
      alos198: '19',
      alosHashachar: '16',
      tzais161: '16',
      tzais18: '18',
      misheyakir102: '10',
    };
    for (const [key, angle] of Object.entries(ANGLES)) {
      expect(z.shitot[key], `shitot.${key}`).toContain('°');
      expect(z.shitot[key], `shitot.${key}`).toContain(angle);
    }
  });

  it.each(LOCALES)('%s never states a fixed-minute opinion in degrees', (loc) => {
    const z = CATALOGS[loc].zmanim as unknown as Registers;
    for (const def of ZMANIM.filter((d) => d.family === 'fixedMinutes')) {
      expect(z.shitot[def.key], `shitot.${def.key}`).not.toContain('°');
    }
  });
});

describe('zmanLabels fallback', () => {
  it.each(LOCALES)('%s falls back to the canonical label where no override exists', (loc) => {
    const z = CATALOGS[loc].zmanim as unknown as Registers;
    const labels = zmanLabels(translator(loc));
    for (const def of ZMANIM) {
      const expected = z.shitotShort?.[def.key] ?? z.shitot[def.key];
      expect(labels.shitaShort(def.key), `shitaShort.${def.key}`).toBe(expected);
    }
  });

  it.each(LOCALES)('%s resolves a name at every width for every base', (loc) => {
    const labels = zmanLabels(translator(loc));
    for (const base of BASES) {
      expect(labels.nameShort(base).trim(), `nameShort.${base}`).not.toBe('');
      expect(labels.abbr(base).trim(), `abbr.${base}`).not.toBe('');
    }
  });

  it.each(LOCALES)('%s short name is never longer than the full name', (loc) => {
    const labels = zmanLabels(translator(loc));
    for (const def of ZMANIM) {
      expect(zmanNameShortForKey(labels, def.key).length, `namesShort for ${def.key}`).toBeLessThanOrEqual(
        labels.name(def.key).length,
      );
    }
  });
});
