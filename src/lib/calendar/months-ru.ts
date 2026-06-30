/**
 * Russian transliterations of the Jewish months, in kosher-zmanim's
 * `getTransliteratedMonthList()` order. Installed via
 * `HebrewDateFormatter.setTransliteratedMonthList` for the `ru` locale (see
 * `createHebrewFormatter`); English/Hebrew keep the formatter's own list.
 *
 * The array must stay 1:1 with the default order below — it's indexed by month,
 * including the leap-year Adar I / Adar II at the end. Terminology mirrors the
 * companion `zmanim_bot`.
 *
 * Default (en): Nissan, Iyar, Sivan, Tammuz, Av, Elul, Tishrei, Cheshvan,
 * Kislev, Teves, Shevat, Adar, Adar II, Adar I.
 */
export const RU_MONTHS: string[] = [
  'Нисан',
  'Ияр',
  'Сиван',
  'Таммуз',
  'Ав',
  'Элул',
  'Тишрей',
  'Хешван',
  'Кислев',
  'Тевет',
  'Шват',
  'Адар',
  'Адар II',
  'Адар I',
];
