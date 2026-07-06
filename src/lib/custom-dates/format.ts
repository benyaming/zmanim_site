import type { HebrewDateFormatter } from 'kosher-zmanim';

import { createHebrewFormatter, RU_MONTHS_GENITIVE } from '@/lib/calendar';

import { toJewishDate } from './occurrences';
import type { HebrewDateParts } from './types';

/** Lazy per-locale formatters — module-level like day-info's, they're stateless. */
const formatters = new Map<string, HebrewDateFormatter>();

function formatterFor(locale: string): HebrewDateFormatter {
  let fmt = formatters.get(locale);
  if (!fmt) {
    fmt = createHebrewFormatter(locale);
    formatters.set(locale, fmt);
  }
  return fmt;
}

/** Genitive Russian month formatter ("14 Адара"), mirroring day-info's label rule. */
let ruGenitive: HebrewDateFormatter | undefined;

function ruGenitiveFormatter(): HebrewDateFormatter {
  if (!ruGenitive) {
    ruGenitive = createHebrewFormatter('ru');
    ruGenitive.setTransliteratedMonthList(RU_MONTHS_GENITIVE);
  }
  return ruGenitive;
}

/** The month's display name in the given Hebrew year (resolves Adar/Adar I/II). */
export function hebrewMonthName(year: number, month: number, locale: string): string {
  return formatterFor(locale).formatMonth(toJewishDate({ year, month, day: 1 }));
}

/** The Hebrew year label — gematria for Hebrew script, plain digits otherwise. */
export function hebrewYearLabel(year: number, locale: string): string {
  if (locale === 'he') return formatterFor('he').formatHebrewNumber(year);
  return String(year);
}

/**
 * A full Hebrew date for list rows and form previews: Hebrew script with
 * gematria for `he`, "14 Адара 5784" (genitive month) for `ru`, "14 Adar 5784"
 * otherwise.
 */
export function formatHebrewDateParts(parts: HebrewDateParts, locale: string): string {
  const jd = toJewishDate(parts);
  if (locale === 'he') return formatterFor('he').format(jd);
  const month = locale === 'ru' ? ruGenitiveFormatter().formatMonth(jd) : formatterFor(locale).formatMonth(jd);
  return `${parts.day} ${month} ${parts.year}`;
}
