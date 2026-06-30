import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { getDayInfo } from './day-info';

describe('getDayInfo', () => {
  it.each([
    ['2024-04-23', 'yomTov', 'Pesach'], // 1st day Pesach
    ['2024-04-26', 'cholHamoed', 'Chol Hamoed Pesach'],
    ['2024-10-12', 'yomTov', 'Yom Kippur'], // also a Shabbos + fast — yomTov wins
    ['2024-12-26', 'weekday', 'Chanukah 1'], // minor festival — neutral chip, not Yom Tov
    ['2024-07-23', 'taanis', 'Seventeenth of Tammuz'],
  ])('classifies %s as %s (%s)', (iso, category, label) => {
    const info = getDayInfo(DateTime.fromISO(iso));
    expect(info.category).toBe(category);
    expect(info.label).toBe(label);
  });

  it('marks Rosh Chodesh', () => {
    const info = getDayInfo(DateTime.fromISO('2024-04-09')); // Rosh Chodesh Nissan
    expect(info.isRoshChodesh).toBe(true);
    expect(info.category).toBe('roshChodesh');
  });

  it('exposes the weekly parsha only on Shabbos, with no holiday label', () => {
    const shabbos = getDayInfo(DateTime.fromISO('2024-03-23'));
    expect(shabbos.isShabbos).toBe(true);
    expect(shabbos.category).toBe('shabbos');
    expect(shabbos.parsha).toBe('Vayikra');
    expect(shabbos.label).toBeNull();

    const weekday = getDayInfo(DateTime.fromISO('2024-06-18')); // plain Tuesday
    expect(weekday.category).toBe('weekday');
    expect(weekday.parsha).toBeNull();
    expect(weekday.label).toBeNull();
  });

  it('localizes the parsha for the ru locale', () => {
    const shabbos = getDayInfo(DateTime.fromISO('2024-03-23'), undefined, 'ru');
    expect(shabbos.parsha).toBe('Ваикра');
    // weekParsha is meaningful on weekdays too and must also be Russian.
    const weekday = getDayInfo(DateTime.fromISO('2024-03-19'), undefined, 'ru');
    expect(weekday.parsha).toBeNull();
    expect(weekday.weekParsha).toBe('Ваикра');
  });

  it('reports the Hebrew date', () => {
    const info = getDayInfo(DateTime.fromISO('2024-04-23')); // 15 Nissan 5784
    expect(info.hebrewDayOfMonth).toBe(15);
    expect(info.hebrewMonth).toBe('Nissan');
  });

  it('localizes the Hebrew month for the ru locale', () => {
    const info = getDayInfo(DateTime.fromISO('2024-04-23'), undefined, 'ru'); // 15 Nissan 5784
    expect(info.hebrewMonth).toBe('Нисан');
  });

  it('uses the Israel vs. diaspora parsha schedule per the inIsrael flag', () => {
    // June 2026 is a divergence period (diaspora is a week behind until a double).
    const date = DateTime.fromISO('2026-06-06');
    expect(getDayInfo(date, undefined, 'en', true).parsha).toBe("Sh'lach");
    expect(getDayInfo(date, undefined, 'en', false).parsha).toBe("Beha'aloscha");
  });
});
