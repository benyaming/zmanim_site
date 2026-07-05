import { describe, expect, it } from 'vitest';

import { ZMANIM } from './definitions';
import { CONFIGURABLE_ZMANIM, sanitizeHiddenZmanim } from './visibility';

describe('CONFIGURABLE_ZMANIM', () => {
  it('is every zman except candle lighting and the Erev Pesach-only ones', () => {
    const keys = CONFIGURABLE_ZMANIM.map((z) => z.key);
    expect(keys).not.toContain('candleLighting');
    expect(keys).not.toContain('sofZmanAchilasChametzGRA');
    expect(keys).toEqual(ZMANIM.filter((z) => z.key !== 'candleLighting' && !z.erevPesachOnly).map((z) => z.key));
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
