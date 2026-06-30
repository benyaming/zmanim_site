import type { MetadataRoute } from 'next';

import { routing } from '@/i18n/routing';
import { CITIES } from '@/lib/cities';
import { SITE_URL } from '@/lib/site';

/** Prefix a path with the locale (default locale has no prefix). */
function localePath(locale: string, path: string): string {
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  return `${SITE_URL}${prefix}${path === '/' ? '' : path}` || `${SITE_URL}/`;
}

/** Build per-locale hreflang alternates for a given path. */
function alternates(path: string): Record<string, string> {
  return Object.fromEntries(routing.locales.map((locale) => [locale, localePath(locale, path)]));
}

function entriesForPath(path: string, priority: number, changeFrequency: 'daily' | 'weekly'): MetadataRoute.Sitemap {
  return routing.locales.map((locale) => ({
    url: localePath(locale, path),
    changeFrequency,
    priority,
    alternates: { languages: alternates(path) },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...entriesForPath('/', 1, 'daily'),
    ...entriesForPath('/zmanim', 0.9, 'weekly'),
    ...CITIES.flatMap((c) => entriesForPath(`/zmanim/${c.slug}`, 0.8, 'daily')),
  ];
}
