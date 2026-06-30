import { ArrowRight, MapPin } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DateTime } from 'luxon';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ZmanimList } from '@/components/zmanim/zmanim-list';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getDayInfo, localizedHolidayLabel } from '@/lib/calendar';
import { CITIES, getCity } from '@/lib/cities';
import { isIsraelTimezone } from '@/lib/location';
import { appLink, SITE_NAME } from '@/lib/site';
import { buildZmanimGroups, computeZmanim } from '@/lib/zmanim';

// Regenerate at most every 30 minutes so "today" stays fresh without rebuilds.
export const revalidate = 1800;
// Only the curated city slugs are valid; anything else 404s (no junk pages).
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => CITIES.map((c) => ({ locale, city: c.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; city: string }>;
}): Promise<Metadata> {
  const { locale, city: slug } = await params;
  const city = getCity(slug);
  if (!city) return {};
  const t = await getTranslations({ locale, namespace: 'city' });
  const title = t('metaTitle', { city: city.name, country: city.country });
  const description = t('metaDescription', { city: city.name, country: city.country });
  const url = `/zmanim/${city.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: SITE_NAME },
    twitter: { card: 'summary', title, description },
  };
}

export default async function CityZmanimPage({ params }: { params: Promise<{ locale: string; city: string }> }) {
  const { locale, city: slug } = await params;
  setRequestLocale(locale);
  const city = getCity(slug);
  if (!city) notFound();

  const t = await getTranslations({ locale, namespace: 'city' });
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const tName = await getTranslations({ locale, namespace: 'zmanim.names' });
  const tShita = await getTranslations({ locale, namespace: 'zmanim.shitot' });
  const tDetail = await getTranslations({ locale, namespace: 'zmanim.descriptions' });
  const tBaseDesc = await getTranslations({ locale, namespace: 'zmanim.baseDescriptions' });
  const tGroup = await getTranslations({ locale, namespace: 'zmanim.groups' });

  const today = DateTime.now().setZone(city.timeZoneId);
  const zmanim = computeZmanim({
    lat: city.lat,
    lng: city.lng,
    date: today,
    timeZoneId: city.timeZoneId,
    candleLightingOffset: city.candleLightingOffset,
  });
  const info = getDayInfo(today, undefined, locale, isIsraelTimezone(city.timeZoneId));
  const holidayLabel = localizedHolidayLabel(locale, info.label, info.yomTovIndex, info.dayOfChanukah);
  const isErev = today.weekday === 5 || info.category === 'erevYomTov';
  const groups = buildZmanimGroups(
    zmanim.filter((z) => !z.erevOnly || isErev),
    { name: tName, shita: tShita, detail: tDetail, baseDescription: tBaseDesc, group: tGroup },
  );

  const otherCities = CITIES.filter((c) => c.slug !== city.slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('heading', { city: city.name, country: city.country }),
    about: {
      '@type': 'Place',
      name: city.name,
      geo: { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lng },
    },
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader right={<LanguageSwitcher />} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <nav className="text-muted-foreground mb-4 text-sm">
          <Link href="/zmanim" className="hover:underline">
            {tNav('allCities')}
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{city.name}</span>
        </nav>

        <header className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('heading', { city: city.name, country: city.country })}</h1>
          <p className="text-muted-foreground mt-1">
            {today.setLocale(locale).toLocaleString({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} ·{' '}
            {info.hebrewDayOfMonth} {info.hebrewMonth}
            {holidayLabel && <span className="text-foreground"> · {holidayLabel}</span>}
          </p>
        </header>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2 px-5 py-4">
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <MapPin className="size-4" />
              {city.name}
            </div>
            <Link
              href={appLink(city.lat, city.lng, city.name)}
              className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              {tNav('openCalendar')} <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 py-3">
            <ZmanimList groups={groups} locale={locale} />
          </CardContent>
        </Card>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">{t('otherCities')}</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {otherCities.map((c) => (
              <li key={c.slug}>
                <Link href={`/zmanim/${c.slug}`} className="text-muted-foreground hover:text-foreground text-sm hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
