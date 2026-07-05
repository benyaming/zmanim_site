'use client';

import { createTranslator } from 'next-intl';

import en from '@/../messages/en.json';
import he from '@/../messages/he.json';
import ru from '@/../messages/ru.json';

/**
 * Report-language support: exports can be generated in any app language,
 * independent of the UI locale. All three catalogs are imported statically —
 * they are small, and the preview needs the chosen catalog synchronously.
 */
export const REPORT_LOCALES = ['en', 'he', 'ru'] as const;
export type ReportLocale = (typeof REPORT_LOCALES)[number];

const MESSAGES: Record<ReportLocale, unknown> = { en, he, ru };

/** Loosely-typed translator over full dotted paths ("zmanim.names.sunrise"). */
export type ReportTranslator = (key: string, values?: Record<string, string | number | Date>) => string;

export function reportTranslator(locale: string): ReportTranslator {
  const l: ReportLocale = (REPORT_LOCALES as readonly string[]).includes(locale) ? (locale as ReportLocale) : 'en';
  return createTranslator({ locale: l, messages: MESSAGES[l] as never }) as unknown as ReportTranslator;
}
