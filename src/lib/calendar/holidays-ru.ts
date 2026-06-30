/**
 * Russian names for significant days, keyed by kosher-zmanim's getYomTovIndex().
 * kosher-zmanim has no Russian dataset, so for the `ru` locale we override the
 * English formatter output with these. English/Hebrew keep the (authoritative)
 * formatter output.
 */
const RU_HOLIDAYS: Record<number, string> = {
  0: 'Канун Песаха',
  1: 'Песах',
  2: 'Холь а-Моэд Песах',
  3: 'Песах Шени',
  4: 'Канун Шавуот',
  5: 'Шавуот',
  6: '17-е Таммуза',
  7: '9-е Ава',
  8: 'Ту бе-Ав',
  9: 'Канун Рош а-Шана',
  10: 'Рош а-Шана',
  11: 'Пост Гедалии',
  12: 'Канун Йом Киппур',
  13: 'Йом Киппур',
  14: 'Канун Суккот',
  15: 'Суккот',
  16: 'Холь а-Моэд Суккот',
  17: 'Ошана Раба',
  18: 'Шмини Ацерет',
  19: 'Симхат Тора',
  21: 'Ханука',
  22: '10-е Тевета',
  23: 'Ту би-Шват',
  24: 'Пост Эстер',
  25: 'Пурим',
  26: 'Шушан Пурим',
  27: 'Пурим Катан',
  28: 'Рош Ходеш',
  29: 'День памяти Катастрофы и героизма',
  30: 'День памяти павших в войнах Израиля',
  31: 'День независимости Израиля',
  32: 'День Иерусалима',
  33: 'Лаг ба-Омер',
  34: 'Шушан Пурим Катан',
  35: 'Исру Хаг',
  36: 'Йом Кипур Катан',
  37: 'БеХаБ',
};

/** Russian significant-day label (with Chanukah day appended), or null. */
export function ruHolidayLabel(yomTovIndex: number, dayOfChanukah = 0): string | null {
  const name = RU_HOLIDAYS[yomTovIndex];
  if (!name) return null;
  return dayOfChanukah > 0 ? `${name} ${dayOfChanukah}` : name;
}

/**
 * Locale-aware significant-day label: Russian override for `ru`, otherwise the
 * formatter-provided name (`fallback`).
 */
export function localizedHolidayLabel(
  locale: string,
  fallback: string | null,
  yomTovIndex: number,
  dayOfChanukah = 0,
): string | null {
  if (locale === 'ru') return ruHolidayLabel(yomTovIndex, dayOfChanukah) ?? fallback;
  return fallback;
}
