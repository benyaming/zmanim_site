import { describe, expect, it } from 'vitest';

import { MAX_CUSTOM_DATES } from './types';
import { MAX_HEBREW_YEAR, MIN_HEBREW_YEAR, newCustomDateId, sanitizeCustomDates } from './sanitize';
import type { CustomDate } from './types';

const valid: CustomDate = { id: 'a1', kind: 'yahrzeit', label: 'Grandpa', hebrew: { year: 5784, month: 12, day: 14 } };

describe('newCustomDateId', () => {
  it('generates unique ids', () => {
    expect(newCustomDateId()).not.toBe(newCustomDateId());
  });

  it('falls back when crypto.randomUUID is unavailable (insecure context, old Safari)', () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const a = newCustomDateId();
      const b = newCustomDateId();
      expect(a).toBeTruthy();
      expect(a).not.toBe(b);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
    }
  });
});

describe('sanitizeCustomDates', () => {
  it('keeps a valid entry and preserves optional fields', () => {
    const entry: CustomDate = { ...valid, afterSunset: true, adarBehavior: 'adar2' };
    expect(sanitizeCustomDates([entry])).toEqual([entry]);
  });

  it('returns [] for non-arrays and drops non-object items', () => {
    expect(sanitizeCustomDates(null)).toEqual([]);
    expect(sanitizeCustomDates('nope')).toEqual([]);
    expect(sanitizeCustomDates([1, 'x', null, valid])).toEqual([valid]);
  });

  it('drops entries with a missing or duplicate id', () => {
    expect(sanitizeCustomDates([{ ...valid, id: '' }])).toEqual([]);
    const [a, b] = [valid, { ...valid, label: 'Other' }];
    expect(sanitizeCustomDates([a, b])).toEqual([a]);
  });

  it('drops entries with an unknown kind or non-string label', () => {
    expect(sanitizeCustomDates([{ ...valid, kind: 'wedding' as never }])).toEqual([]);
    expect(sanitizeCustomDates([{ ...valid, label: 42 as never }])).toEqual([]);
  });

  it('drops arithmetically impossible Hebrew dates before they reach kosher-zmanim', () => {
    // Month 13 in a non-leap year (5785 is not a leap year).
    expect(sanitizeCustomDates([{ ...valid, hebrew: { year: 5785, month: 13, day: 1 } }])).toEqual([]);
    // 30 Cheshvan in a year whose Cheshvan has 29 days (5786).
    expect(sanitizeCustomDates([{ ...valid, hebrew: { year: 5786, month: 8, day: 30 } }])).toEqual([]);
    // Out-of-range years and non-integers.
    expect(sanitizeCustomDates([{ ...valid, hebrew: { year: MIN_HEBREW_YEAR - 1, month: 1, day: 1 } }])).toEqual([]);
    expect(sanitizeCustomDates([{ ...valid, hebrew: { year: MAX_HEBREW_YEAR + 1, month: 1, day: 1 } }])).toEqual([]);
    expect(sanitizeCustomDates([{ ...valid, hebrew: { year: 5784.5, month: 1, day: 1 } }])).toEqual([]);
  });

  it('strips invalid optional fields rather than dropping the entry', () => {
    const out = sanitizeCustomDates([{ ...valid, afterSunset: 'yes' as never, adarBehavior: 'adar3' as never }]);
    expect(out).toEqual([valid]);
    expect(out[0].afterSunset).toBeUndefined();
    expect(out[0].adarBehavior).toBeUndefined();
  });

  it('caps the list at MAX_CUSTOM_DATES', () => {
    const many = Array.from({ length: MAX_CUSTOM_DATES + 5 }, (_, i) => ({ ...valid, id: `id-${i}` }));
    expect(sanitizeCustomDates(many)).toHaveLength(MAX_CUSTOM_DATES);
  });
});
