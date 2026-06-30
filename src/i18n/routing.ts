import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'he', 'ru'],
  defaultLocale: 'en',
  // Default locale has no prefix (/), others are prefixed (/he, /ru).
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];

/** Text direction per locale (Hebrew is right-to-left). */
export function dirForLocale(locale: string): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}
