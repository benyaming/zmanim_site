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
   * The two Russian registers answer to different rules, which is the whole
   * reason the short one exists.
   *
   * `shitot` is what the app, the picker and the weekly sheet show, and it
   * spells authorities out — a reader is not expected to expand ГР״А. Only
   * `shitotShort` may abbreviate, because it fills month-sheet columns and
   * footer blocks where the width genuinely is not there.
   */
  it('russian spells authorities out in the canonical register', () => {
    const z = CATALOGS.ru.zmanim as unknown as Registers;
    for (const [key, label] of Object.entries(z.shitot)) {
      // The gershayim is what makes ГР״А and Р״Т acronyms.
      expect(label, `ru.shitot.${key}`).not.toContain('״');
      // МА carries none, so pin it by name.
      expect(label, `ru.shitot.${key}`).not.toMatch(/^МА(\s|$)/);
    }
    const labels = zmanLabels(translator('ru'));
    expect(labels.shita('sofZmanShmaGRA')).toBe('Виленский Гаон');
    expect(labels.shita('sofZmanShmaMGA161')).toBe('Маген Авраам · алот 16,1°');
    expect(labels.shita('tzais72')).toBe('Рабейну Там · 72 минуты');
  });

  it('russian keeps the abbreviations in the print-column register', () => {
    const labels = zmanLabels(translator('ru'));
    expect(labels.shitaShort('sofZmanShmaGRA')).toBe('ГР״А');
    expect(labels.shitaShort('sofZmanShmaMGA161')).toBe('МА 16,1°');
    expect(labels.shitaShort('tzais72')).toBe('Р״Т 72');
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
