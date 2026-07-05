import { describe, expect, it } from 'vitest';

import { ZMANIM } from './definitions';
import { CONFIGURABLE_ZMANIM, DEFAULT_HIDDEN_ZMANIM, sanitizeHiddenZmanim } from './visibility';

describe('CONFIGURABLE_ZMANIM', () => {
  it('is every zman except candle lighting and the Erev Pesach-only ones', () => {
    const keys = CONFIGURABLE_ZMANIM.map((z) => z.key);
    expect(keys).not.toContain('candleLighting');
    expect(keys).not.toContain('sofZmanAchilasChametzGRA');
    expect(keys).toEqual(ZMANIM.filter((z) => z.key !== 'candleLighting' && !z.erevPesachOnly).map((z) => z.key));
  });
});

describe('DEFAULT_HIDDEN_ZMANIM', () => {
  it('leaves exactly the everyday one-shita-per-zman set visible', () => {
    const hidden = new Set(DEFAULT_HIDDEN_ZMANIM);
    const visible = CONFIGURABLE_ZMANIM.map((z) => z.key).filter((k) => !hidden.has(k));
    expect(visible).toEqual([
      'alosHashachar', // 16.1°
      'misheyakir102', // 10.2°
      'sunrise',
      'sofZmanShmaGRA',
      'sofZmanTfilaGRA',
      'chatzos',
      'minchaGedola',
      'minchaKetana',
      'plagHamincha',
      'sunset',
      'tzais', // 8.5°
    ]);
  });

  it('is a valid persisted hide list (survives sanitize unchanged)', () => {
    expect(sanitizeHiddenZmanim([...DEFAULT_HIDDEN_ZMANIM])).toEqual([...DEFAULT_HIDDEN_ZMANIM]);
  });
});

describe('sanitizeHiddenZmanim', () => {
  it('returns [] for anything that is not an array', () => {
    expect(sanitizeHiddenZmanim(undefined)).toEqual([]);
    expect(sanitizeHiddenZmanim(null)).toEqual([]);
    expect(sanitizeHiddenZmanim('tzais')).toEqual([]);
    expect(sanitizeHiddenZmanim({ tzais: true })).toEqual([]);
  });

  it('keeps only known configurable keys', () => {
    expect(sanitizeHiddenZmanim(['tzais', 'nope', 42, null, 'sunrise'])).toEqual(['tzais', 'sunrise']);
  });

  it('drops candleLighting — it is not user-hideable', () => {
    expect(sanitizeHiddenZmanim(['candleLighting', 'sunset'])).toEqual(['sunset']);
  });

  it('de-duplicates repeated keys', () => {
    expect(sanitizeHiddenZmanim(['tzais', 'tzais', 'tzais72'])).toEqual(['tzais', 'tzais72']);
  });

  it('accepts every configurable key', () => {
    const all = CONFIGURABLE_ZMANIM.map((z) => z.key);
    expect(sanitizeHiddenZmanim(all)).toEqual(all);
  });
});
