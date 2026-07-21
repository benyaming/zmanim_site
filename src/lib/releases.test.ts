import { describe, expect, it } from 'vitest';

import { APP_VERSION, RELEASES, compareVersions, releasesSince } from './releases';

describe('compareVersions', () => {
  it('compares dotted versions numerically, not lexicographically', () => {
    expect(compareVersions('1.10', '1.9')).toBeGreaterThan(0);
    expect(compareVersions('1.9', '1.10')).toBeLessThan(0);
    expect(compareVersions('2.0', '1.14')).toBeGreaterThan(0);
    expect(compareVersions('1.14', '1.14')).toBe(0);
  });

  it('treats missing segments as zero', () => {
    expect(compareVersions('1', '1.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0')).toBeGreaterThan(0);
  });

  it('treats non-numeric segments as zero, never returning NaN', () => {
    expect(compareVersions('abc', '1.0')).toBeLessThan(0);
    expect(compareVersions('1.x', '1.0')).toBe(0);
    expect(Number.isNaN(compareVersions('garbage', 'also.garbage'))).toBe(false);
  });
});

describe('releasesSince', () => {
  it('returns the full changelog when no version was seen', () => {
    expect(releasesSince(null)).toEqual(RELEASES);
    expect(releasesSince('')).toEqual(RELEASES);
  });

  it('returns nothing when the user is current (or somehow ahead)', () => {
    expect(releasesSince(APP_VERSION)).toEqual([]);
    expect(releasesSince('99.0')).toEqual([]);
  });

  it('returns only the releases newer than the last seen version', () => {
    const unseen = releasesSince('1.12');
    expect(unseen.map((r) => r.version)).toEqual([
      '1.22',
      '1.21',
      '1.20',
      '1.19',
      '1.18',
      '1.17',
      '1.16',
      '1.15',
      '1.14',
      '1.13',
    ]);
  });

  it('treats a corrupted stored version as older than everything', () => {
    expect(releasesSince('garbage')).toEqual(RELEASES);
  });
});

describe('RELEASES ordering', () => {
  it('is strictly newest-first, so releasesSince slices a clean prefix', () => {
    for (let i = 1; i < RELEASES.length; i++) {
      expect(compareVersions(RELEASES[i - 1].version, RELEASES[i].version)).toBeGreaterThan(0);
    }
  });
});
