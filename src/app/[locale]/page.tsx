import { setRequestLocale } from 'next-intl/server';

import { App } from '@/components/app';
import { type AppLocation, makeLocation } from '@/lib/location';

/** Build an initial location from the deep-link query (?lat=&lng=&label=). */
function locationFromQuery(searchParams: Record<string, string | string[] | undefined>): AppLocation | undefined {
  const lat = Number(searchParams.lat);
  const lng = Number(searchParams.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return undefined;
  const label = typeof searchParams.label === 'string' ? searchParams.label : 'Selected location';
  return makeLocation(lat, lng, label);
}

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  return <App initialLocation={locationFromQuery(sp)} />;
}
