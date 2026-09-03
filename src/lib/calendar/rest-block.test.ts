import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { isRestDay, isYomTovRestDay, restBlockFor } from './rest-block';

const d = (iso: string) => DateTime.fromISO(iso);
/** The block as ISO dates, for readable expectations. */
const block = (iso: string, inIsrael = false) => {
  const b = restBlockFor(d(iso), inIsrael);
  return b && {
    erev: b.erev.toISODate(),
    firstRest: b.firstRest.toISODate(),
    lastRest: b.lastRest.toISODate(),
    multiDay: b.multiDay,
  };
};

describe('isRestDay', () => {
  it('is true on Shabbat and on a work-prohibited Yom Tov', () => {
    expect(isRestDay(d('2024-03-23'), false)).toBe(true); // Shabbat
    expect(isRestDay(d('2024-04-23'), false)).toBe(true); // Pesach day 1
  });

  it('is false on the minor festivals isYomTov() reports (Purim, Chanukah)', () => {
    expect(isRestDay(d('2024-03-24'), false)).toBe(false); // Purim
    expect(isRestDay(d('2024-12-26'), false)).toBe(false); // Chanukah
  });

  it('follows the Israel / diaspora luach on the 2nd Yom Tov day', () => {
    expect(isRestDay(d('2024-04-24'), false)).toBe(true); // Pesach day 2, diaspora
    expect(isRestDay(d('2024-04-24'), true)).toBe(false); // Chol Hamoed in Israel
  });
});

describe('isYomTovRestDay', () => {
  // The naming rule for a rest block's heading rides on this: a rest day is
  // named by its festival only when the festival is why it is a rest day. The
  // formatter's significant-day label is NOT that test — it also fires on the
  // days below, every one of which is a rest day only because it is Shabbat.
  it('is false on a Shabbat whose significant-day label is not a Yom Tov', () => {
    expect(isYomTovRestDay(d('2025-04-12'), false)).toBe(false); // Erev Pesach
    expect(isYomTovRestDay(d('2024-10-19'), false)).toBe(false); // Chol Hamoed Succos
    expect(isYomTovRestDay(d('2024-10-26'), false)).toBe(false); // Isru Chag
    expect(isYomTovRestDay(d('2024-03-23'), false)).toBe(false); // a plain Shabbat
  });

  it('is true on a Yom Tov, Shabbat or not', () => {
    expect(isYomTovRestDay(d('2026-09-12'), false)).toBe(true); // Rosh Hashana on Shabbat
    expect(isYomTovRestDay(d('2024-04-23'), false)).toBe(true); // Pesach day 1, a Tuesday
  });

  it('follows the Israel / diaspora luach', () => {
    expect(isYomTovRestDay(d('2024-04-24'), false)).toBe(true); // Pesach day 2, diaspora
    expect(isYomTovRestDay(d('2024-04-24'), true)).toBe(false); // Chol Hamoed in Israel
  });
});

describe('restBlockFor', () => {
  it('is null on a mundane day with no rest day tomorrow', () => {
    expect(block('2024-03-20')).toBeNull(); // Wednesday
  });

  it('gives the same single-day block on Erev Shabbat and on Shabbat', () => {
    const shabbat = { erev: '2024-03-22', firstRest: '2024-03-23', lastRest: '2024-03-23', multiDay: false };
    expect(block('2024-03-22')).toEqual(shabbat); // the eve looks ahead
    expect(block('2024-03-23')).toEqual(shabbat);
  });

  it('joins a two-day Yom Tov into one block — from every day of it', () => {
    // Rosh Hashana 5787: Sat 12 + Sun 13 September 2026, lit from Friday.
    const roshHashana = { erev: '2026-09-11', firstRest: '2026-09-12', lastRest: '2026-09-13', multiDay: true };
    expect(block('2026-09-11')).toEqual(roshHashana);
    expect(block('2026-09-12')).toEqual(roshHashana);
    expect(block('2026-09-13')).toEqual(roshHashana);
  });

  it('joins a Yom Tov that runs into Shabbat', () => {
    // Rosh Hashana 5785: Thu 3 + Fri 4 October 2024, then Shabbat.
    expect(block('2024-10-04')).toEqual({
      erev: '2024-10-02',
      firstRest: '2024-10-03',
      lastRest: '2024-10-05',
      multiDay: true,
    });
  });

  it('is one day in Israel where the diaspora keeps two', () => {
    expect(block('2024-04-23', true)).toEqual({
      erev: '2024-04-22',
      firstRest: '2024-04-23',
      lastRest: '2024-04-23',
      multiDay: false,
    });
    expect(block('2024-04-23', false)).toEqual({
      erev: '2024-04-22',
      firstRest: '2024-04-23',
      lastRest: '2024-04-24',
      multiDay: true,
    });
  });
});
