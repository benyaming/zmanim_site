import { JewishCalendar } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { getDayInfo } from './day-info';
import { localizedHolidayLabel, ruHolidayLabel } from './holidays-ru';

describe('Russian holiday labels', () => {
  it('maps significant-day indices to Russian', () => {
    expect(ruHolidayLabel(JewishCalendar.PESACH)).toBe('Песах');
    expect(ruHolidayLabel(JewishCalendar.YOM_KIPPUR)).toBe('Йом Киппур');
    expect(ruHolidayLabel(JewishCalendar.PURIM)).toBe('Пурим');
    expect(ruHolidayLabel(JewishCalendar.SEVENTEEN_OF_TAMMUZ)).toBe('17-е Таммуза');
  });

  it('appends the Chanukah day number', () => {
    expect(ruHolidayLabel(JewishCalendar.CHANUKAH, 1)).toBe('Ханука 1');
    expect(ruHolidayLabel(JewishCalendar.CHANUKAH, 5)).toBe('Ханука 5');
  });

  it('returns null for non-significant days', () => {
    expect(ruHolidayLabel(-1)).toBeNull();
  });

  it('overrides only for the ru locale, falling back otherwise', () => {
    const info = getDayInfo(DateTime.fromISO('2024-04-23')); // Pesach
    expect(localizedHolidayLabel('ru', info.label, info.yomTovIndex, info.dayOfChanukah)).toBe('Песах');
    expect(localizedHolidayLabel('en', info.label, info.yomTovIndex, info.dayOfChanukah)).toBe('Pesach');
    expect(localizedHolidayLabel('he', info.label, info.yomTovIndex, info.dayOfChanukah)).toBe('Pesach');
  });
});
