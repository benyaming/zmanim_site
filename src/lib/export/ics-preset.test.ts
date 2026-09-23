import { describe, expect, it } from 'vitest';

import {
  ICS_DAILY_ZMAN_KEYS,
  MAX_ICS_DAILY_ZMANIM,
  MAX_ICS_DAYS,
  sanitizeIcsExportPreset,
  sanitizeIcsZmanKeys,
  sanitizeObservanceKinds,
} from './ics-preset';

describe('ICS_DAILY_ZMAN_KEYS', () => {
  it('offers moments only: no durations, no candle lighting, no Erev Pesach deadlines', () => {
    expect(ICS_DAILY_ZMAN_KEYS).not.toContain('shaahZmanisGRA');
    expect(ICS_DAILY_ZMAN_KEYS).not.toContain('shaahZmanisMGA');
    expect(ICS_DAILY_ZMAN_KEYS).not.toContain('candleLighting');
    expect(ICS_DAILY_ZMAN_KEYS.some((k) => k.includes('Chametz'))).toBe(false);
    expect(ICS_DAILY_ZMAN_KEYS).toContain('sunrise');
  });
});

describe('sanitizeIcsZmanKeys', () => {
  it('drops unknown, duration and duplicate keys before capping, in definition order', () => {
    const valid = ICS_DAILY_ZMAN_KEYS.slice(0, MAX_ICS_DAILY_ZMANIM + 2);
    const input = ['bogus', 'shaahZmanisGRA', 'candleLighting', 7, ...[...valid].reverse(), valid[0]];
    expect(sanitizeIcsZmanKeys(input)).toEqual(valid.slice(0, MAX_ICS_DAILY_ZMANIM));
  });

  it('treats a non-array as none', () => {
    expect(sanitizeIcsZmanKeys('sunrise')).toEqual([]);
  });
});

describe('sanitizeObservanceKinds', () => {
  it('keeps known kinds once, in the panel order, and an empty list stays empty', () => {
    expect(sanitizeObservanceKinds(['yahrzeit', 'nope', 'hebrewBirthday', 'yahrzeit'])).toEqual(['hebrewBirthday', 'yahrzeit']);
    expect(sanitizeObservanceKinds([])).toEqual([]);
  });
});

describe('sanitizeIcsExportPreset', () => {
  it('returns null for garbage and for an object with nothing usable', () => {
    for (const v of [null, undefined, 3, 'x', [], {}, { rangeDays: 0 }, { reportLocale: 'fr' }]) {
      expect(sanitizeIcsExportPreset(v)).toBeNull();
    }
  });

  it('keeps an explicitly empty selection distinct from an absent one', () => {
    const emptied = sanitizeIcsExportPreset({ personalKinds: ['stale-kind'], zmanKeys: ['stale-zman'], personal: false });
    expect(emptied).toEqual({ personalKinds: [], zmanKeys: [], personal: false });
    const absent = sanitizeIcsExportPreset({ rangeDays: 30 });
    expect(absent).toEqual({ rangeDays: 30 });
    expect(absent).not.toHaveProperty('personalKinds');
  });

  it('bounds the range and validates every field', () => {
    expect(sanitizeIcsExportPreset({ rangeDays: 1 })?.rangeDays).toBe(1);
    expect(sanitizeIcsExportPreset({ rangeDays: MAX_ICS_DAYS })?.rangeDays).toBe(MAX_ICS_DAYS);
    expect(sanitizeIcsExportPreset({ rangeDays: MAX_ICS_DAYS + 1, personal: true })).toEqual({ personal: true });
    expect(sanitizeIcsExportPreset({ rangeDays: 12.5, personal: true })).toEqual({ personal: true });
    expect(
      sanitizeIcsExportPreset({
        categories: { candles: false, fasts: 'yes', bogus: true },
        locationId: 'current',
        reportLocale: 'he',
      }),
    ).toEqual({ categories: { candles: false }, locationId: 'current', reportLocale: 'he' });
  });
});
