import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { JewishDate } from 'kosher-zmanim';

import { createHebrewFormatter, getDayInfo, isErevPesach } from './day-info';

describe('getDayInfo', () => {
  it.each([
    ['2024-04-23', 'yomTov', 'Pesach'], // 1st day Pesach
    ['2024-04-26', 'cholHamoed', 'Chol Hamoed Pesach'],
    ['2024-10-12', 'yomTov', 'Yom Kippur'], // also a Shabbos + fast — yomTov wins
    ['2024-12-26', 'weekday', 'Chanukah 1'], // minor festival — neutral chip, not Yom Tov
    ['2024-07-23', 'taanis', 'Seventeenth of Tammuz'],
    // Minor holidays: isYomTov() reports them, but work is permitted — they must
    // classify as labeled weekdays (holiday tint), never as Yom Tov.
    ['2026-03-03', 'weekday', 'Purim'],
    ['2026-05-01', 'weekday', 'Pesach Sheni'],
    ['2026-07-29', 'weekday', "Tu B'Av"],
    ['2026-05-22', 'yomTov', 'Shavuos'], // work-prohibited — stays Yom Tov
    ['2026-04-10', 'isruChag', 'Isru Chag'], // day after Pesach (diaspora) — neutral grey, not the holiday tint
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

  it.each([
    ['2026-04-14', 'Yom HaShoah'],
    ['2026-04-21', 'Yom Hazikaron'],
    ['2026-04-22', "Yom Ha'atzmaut"],
    ['2026-05-15', 'Yom Yerushalayim'],
  ])('labels the Israeli national day on %s (%s) as a minor (labeled-weekday) day', (iso, label) => {
    const info = getDayInfo(DateTime.fromISO(iso));
    expect(info.label).toBe(label);
    expect(info.category).toBe('weekday'); // work permitted — never the Yom Tov color
  });

  it('localizes the Israeli national days for the ru locale via the yomTovIndex', () => {
    // The ru override is keyed by yomTovIndex, which must be populated for
    // modern holidays (YOM_HAATZMAUT = 31).
    const info = getDayInfo(DateTime.fromISO('2026-04-22'), undefined, 'ru');
    expect(info.yomTovIndex).toBe(31);
  });

  it.each([
    ['2024-04-20', 'Hagadol'], // Shabbat before Pesach
    ['2024-10-05', 'Shuva'], // Shabbat between Rosh Hashana and Yom Kippur
    ['2024-03-23', 'Zachor'], // Shabbat before Purim
  ])('names the special Shabbat on %s (%s)', (iso, name) => {
    expect(getDayInfo(DateTime.fromISO(iso)).specialShabbos).toBe(name);
  });

  it('leaves specialShabbos null on a plain Shabbat and on weekdays', () => {
    expect(getDayInfo(DateTime.fromISO('2024-06-15')).specialShabbos).toBeNull(); // plain Shabbat
    expect(getDayInfo(DateTime.fromISO('2024-04-18')).specialShabbos).toBeNull(); // weekday before Shabbat Hagadol
  });

  it('localizes the special Shabbat name (he / ru)', () => {
    const date = DateTime.fromISO('2024-04-20'); // Shabbat Hagadol
    expect(getDayInfo(date, undefined, 'he').specialShabbos).toBe('הגדול');
    expect(getDayInfo(date, undefined, 'ru').specialShabbos).toBe('а-Гадоль');
  });

  it('attaches the molad only on Rosh Chodesh and Shabbat Mevorchim', () => {
    // RC Nissan 5784: molad Monday 2024-04-08, 22:57 and 7 chalakim.
    const rc = getDayInfo(DateTime.fromISO('2024-04-09'));
    expect(rc.molad).not.toBeNull();
    expect(rc.molad!.date.toISODate()).toBe('2024-04-08');
    expect([rc.molad!.hours, rc.molad!.minutes, rc.molad!.chalakim]).toEqual([22, 57, 7]);

    const mevorchim = getDayInfo(DateTime.fromISO('2024-04-06')); // Shabbat Mevorchim
    expect(mevorchim.isShabbosMevorchim).toBe(true);
    expect(mevorchim.molad).toEqual(rc.molad);

    expect(getDayInfo(DateTime.fromISO('2024-06-18')).molad).toBeNull(); // plain Tuesday
  });

  it('detects Erev Pesach (14 Nissan) for the chametz deadlines', () => {
    expect(isErevPesach(DateTime.fromISO('2024-04-22'))).toBe(true);
    expect(isErevPesach(DateTime.fromISO('2024-04-23'))).toBe(false); // Pesach itself
    expect(isErevPesach(DateTime.fromISO('2024-04-21'))).toBe(false);
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

  it('uses the genitive Hebrew month for the ru day+month label', () => {
    // Russian dates put the month in the genitive after a day number: "15 Нисана".
    const info = getDayInfo(DateTime.fromISO('2024-04-23'), undefined, 'ru'); // 15 Nissan 5784
    expect(info.hebrewMonth).toBe('Нисана');

    const tammuz = getDayInfo(DateTime.fromISO('2026-07-01'), undefined, 'ru'); // 16 Tammuz 5786
    expect(tammuz.hebrewMonth).toBe('Таммуза');
  });

  it('keeps the ru month header in the nominative', () => {
    // The standalone month+year title ("Нисан 5784") stays nominative.
    const jd = new JewishDate(DateTime.fromISO('2024-04-23'));
    expect(createHebrewFormatter('ru').formatMonth(jd)).toBe('Нисан');
  });

  it('resolves the genitive leap-month name (Adar II) in ru', () => {
    // 2024-03-20 is in Adar II 5784 (a leap year) — must decline correctly.
    const info = getDayInfo(DateTime.fromISO('2024-03-20'), undefined, 'ru');
    expect(info.hebrewMonth).toBe('Адара II');
  });

  it('uses the Israel vs. diaspora parsha schedule per the inIsrael flag', () => {
    // June 2026 is a divergence period (diaspora is a week behind until a double).
    const date = DateTime.fromISO('2026-06-06');
    expect(getDayInfo(date, undefined, 'en', true).parsha).toBe("Sh'lach");
    expect(getDayInfo(date, undefined, 'en', false).parsha).toBe("Beha'aloscha");
  });
});
