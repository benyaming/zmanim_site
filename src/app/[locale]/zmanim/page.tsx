import { MapPin } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { CITIES } from '@/lib/cities';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'city' });
  return {
    title: t('indexTitle'),
    description: t('indexDescription'),
    alternates: { canonical: '/zmanim' },
  };
}

export default async function CitiesIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'city' });

  // Group cities by country for a tidy directory.
  const byCountry = new Map<string, typeof CITIES>();
  for (const city of CITIES) {
    byCountry.set(city.country, [...(byCountry.get(city.country) ?? []), city]);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader right={<LanguageSwitcher />} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('indexTitle')}</h1>
        <p className="text-muted-foreground mt-1 mb-6">{t('indexLede')}</p>

        <div className="space-y-6">
          {[...byCountry.entries()].map(([country, cities]) => (
            <section key={country}>
              <h2 className="text-muted-foreground mb-2 text-sm font-semibold tracking-wide uppercase">{country}</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {cities.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/zmanim/${c.slug}`}
                      className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
                    >
                      <MapPin className="text-muted-foreground size-4 shrink-0" />
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
