import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HAVDALAH_OPINION,
  HAVDALAH_OPINIONS,
  havdalahTime,
  havdalahZmanKey,
  isHavdalahOpinion,
} from './havdalah';

describe('havdalah opinions', () => {
  it('matches the zmanim_bot/zmanim_api set and default', () => {
    expect(HAVDALAH_OPINIONS).toEqual([
      'tzeis_5_95_degrees',
      'tzeis_8_5_degrees',
      'tzeis_42_minutes',
      'tzeis_72_minutes',
    ]);
    expect(DEFAULT_HAVDALAH_OPINION).toBe('tzeis_8_5_degrees');
  });

  it('maps each opinion to the correct zman key', () => {
    expect(havdalahZmanKey('tzeis_5_95_degrees')).toBe('tzaisGeonim');
    expect(havdalahZmanKey('tzeis_8_5_degrees')).toBe('tzais');
    expect(havdalahZmanKey('tzeis_42_minutes')).toBe('tzais42');
    expect(havdalahZmanKey('tzeis_72_minutes')).toBe('tzais72');
  });

  it('resolves the time from a computed-zmanim map', () => {
    const byKey = {
      tzaisGeonim: DateTime.fromISO('2024-01-01T19:00'),
      tzais: DateTime.fromISO('2024-01-01T19:10'),
      tzais42: DateTime.fromISO('2024-01-01T19:20'),
      tzais72: DateTime.fromISO('2024-01-01T19:50'),
    };
    expect(havdalahTime('tzeis_5_95_degrees', byKey)).toBe(byKey.tzaisGeonim);
    expect(havdalahTime('tzeis_8_5_degrees', byKey)).toBe(byKey.tzais);
    expect(havdalahTime('tzeis_42_minutes', byKey)).toBe(byKey.tzais42);
    expect(havdalahTime('tzeis_72_minutes', byKey)).toBe(byKey.tzais72);
  });

  it('returns null when the referenced zman is missing', () => {
    expect(havdalahTime('tzeis_8_5_degrees', {})).toBeNull();
  });

  it('validates opinion strings (for persisted prefs)', () => {
    expect(isHavdalahOpinion('tzeis_8_5_degrees')).toBe(true);
    expect(isHavdalahOpinion('nonsense')).toBe(false);
    expect(isHavdalahOpinion(undefined)).toBe(false);
  });
});
