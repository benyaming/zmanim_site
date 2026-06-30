'use client';

import { JewishCalendar } from 'kosher-zmanim';
import { Hourglass } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { computeZmanim } from '@/lib/zmanim';

/** A live "next zman" banner with a ticking countdown, based on the real current time. */
export function NextZman() {
  const { location, candleLightingOffset } = useAppState();
  const locale = useLocale();
  const tName = useTranslations('zmanim.names');
  const t = useTranslations('panel');

  const [now, setNow] = useState(() => DateTime.now().setZone(location.timeZoneId));

  useEffect(() => {
    const id = setInterval(() => setNow(DateTime.now().setZone(location.timeZoneId)), 1000);
    return () => clearInterval(id);
  }, [location.timeZoneId]);

  const zmanim = computeZmanim({
    lat: location.lat,
    lng: location.lng,
    date: now,
    timeZoneId: location.timeZoneId,
    candleLightingOffset,
  });

  // computeZmanim returns a candle-lighting time every day (sunset − offset), but
  // it's only a real zman on Erev Shabbat / Erev Yom Tov — otherwise drop it so
  // it can't show up as the "next zman" on an ordinary weekday.
  const jc = new JewishCalendar(now);
  jc.setInIsrael(location.inIsrael);
  const isErev = now.weekday === 5 || jc.isErevYomTov();

  const next = zmanim
    .filter((z) => (!z.erevOnly || isErev) && z.time && z.time > now)
    .sort((a, b) => a.time!.toMillis() - b.time!.toMillis())[0];

  if (!next || !next.time) {
    return (
      <div className="bg-muted/60 text-muted-foreground flex items-center gap-2 rounded-lg px-4 py-3 text-sm">
        <Hourglass className="size-4" />
        {t('allPassed')}
      </div>
    );
  }

  const diff = next.time.diff(now, ['hours', 'minutes', 'seconds']);
  const countdown = diff.toFormat(diff.hours >= 1 ? 'h:mm:ss' : 'm:ss');

  return (
    <div className="bg-primary text-primary-foreground flex items-center justify-between gap-3 rounded-lg px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Hourglass className="size-4 shrink-0 opacity-90" />
        <div className="min-w-0">
          <p className="text-[0.625rem] font-medium tracking-wide uppercase opacity-70">{t('next')}</p>
          <p className="truncate text-sm leading-tight font-semibold">{tName(next.key)}</p>
        </div>
      </div>
      <div className="shrink-0 text-end">
        <p className="font-mono text-base leading-tight font-semibold tabular-nums" suppressHydrationWarning>
          {countdown}
        </p>
        <p className="text-[0.6875rem] opacity-80">
          {next.time.setLocale(locale).toLocaleString({ hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
