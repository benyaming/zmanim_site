import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { getMolad } from './molad';

/** Total chalakim from an arbitrary epoch, for the lunation-length invariant. */
function toChalakim(m: ReturnType<typeof getMolad>): number {
  const days = Math.round(m.date.diff(DateTime.fromISO('2020-01-01'), 'days').days);
  return ((days * 24 + m.hours) * 60 + m.minutes) * 18 + m.chalakim;
}

describe('getMolad', () => {
  it('matches the published molad of Nissan 5784 (announced on the luach)', () => {
    // Rosh Chodesh Nissan 5784 = 2024-04-09; molad Monday 2024-04-08, 22:57 + 7 chalakim.
    const m = getMolad(DateTime.fromISO('2024-04-09'));
    expect(m.date.toISODate()).toBe('2024-04-08');
    expect(m.date.weekday).toBe(1); // Monday
    expect([m.hours, m.minutes, m.chalakim]).toEqual([22, 57, 7]);
  });

  it('matches the published molad of Tishrei 5785', () => {
    // Rosh Hashana 5785 = 2024-10-03; molad Thursday 2024-10-03, 3:21 + 13 chalakim.
    const m = getMolad(DateTime.fromISO('2024-10-03'));
    expect(m.date.toISODate()).toBe('2024-10-03');
    expect([m.hours, m.minutes, m.chalakim]).toEqual([3, 21, 13]);
  });

  it('reports the INCOMING month on the 30th (first day of a two-day Rosh Chodesh)', () => {
    // 30 Tishrei 5785 = 2024-11-01 is the first day of Rosh Chodesh Cheshvan —
    // the announced molad is Cheshvan's (Friday 16:05 + 14), not Tishrei's.
    const day30 = getMolad(DateTime.fromISO('2024-11-01'));
    const day1 = getMolad(DateTime.fromISO('2024-11-02'));
    expect(day30).toEqual(day1);
    expect(day30.date.toISODate()).toBe('2024-11-01');
    expect([day30.hours, day30.minutes, day30.chalakim]).toEqual([16, 5, 14]);
  });

  it('gives Shabbat Mevorchim the same molad as the Rosh Chodesh it blesses', () => {
    // 2024-04-06 is Shabbat Mevorchim for Rosh Chodesh Nissan (2024-04-09).
    expect(getMolad(DateTime.fromISO('2024-04-06'))).toEqual(getMolad(DateTime.fromISO('2024-04-09')));
  });

  it('spaces consecutive molados exactly one mean lunation apart (29d 12h 793ch)', () => {
    const LUNATION = ((29 * 24 + 12) * 60 + 44) * 18 + 1; // 29d 12h 44m 1ch, in chalakim
    let prev = toChalakim(getMolad(DateTime.fromISO('2024-01-11'))); // RC Shevat 5784
    // Walk a year of Rosh Chodesh months (including the leap Adar I/II pair).
    for (const iso of [
      '2024-02-10', // Adar I
      '2024-03-11', // Adar II
      '2024-04-09', // Nissan
      '2024-05-09', // Iyar
      '2024-06-07', // Sivan
      '2024-07-07', // Tammuz
      '2024-08-05', // Av
      '2024-09-04', // Elul
      '2024-10-03', // Tishrei 5785
    ]) {
      const cur = toChalakim(getMolad(DateTime.fromISO(iso)));
      expect(cur - prev, iso).toBe(LUNATION);
      prev = cur;
    }
  });
});
