'use client';

import { JewishCalendar } from 'kosher-zmanim';
import { BookOpen, Flame, Moon, Sparkles, Utensils, UtensilsCrossed, Wheat } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { DateTime } from 'luxon';
import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';

import { DAY_TONE, significantTone, type DayTone } from '@/components/calendar/day-style';
import { CandleFlames } from '@/components/icons/candle-flames';
import { useAppState, type AppLocation } from '@/components/providers/app-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useZmanim } from '@/hooks/use-zmanim';
import { getDayEvents, getDayInfo, localizedHolidayLabel, type DayEvent, type DayEventType, type DayInfo } from '@/lib/calendar';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { buildZmanimGroups, computeZmanim, havdalahTime, havdalahZmanKey, type HavdalahOpinion } from '@/lib/zmanim';

import { ZmanimList } from './zmanim-list';

const EVENT_META: Record<DayEventType, { Icon: ComponentType<{ className?: string }>; className: string }> = {
  candle: { Icon: CandleFlames, className: 'text-amber-600 dark:text-amber-400' },
  havdalah: { Icon: Sparkles, className: 'text-violet-600 dark:text-violet-400' },
  fastStart: { Icon: UtensilsCrossed, className: 'text-rose-600 dark:text-rose-400' },
  fastEnd: { Icon: Utensils, className: 'text-emerald-600 dark:text-emerald-400' },
};

/** Is this a Shabbat or a work-prohibited Yom Tov (a "rest day")? */
function isRestDay(date: DateTime, inIsrael: boolean): boolean {
  if (date.weekday === 6) return true; // Saturday
  const jc = new JewishCalendar(date);
  jc.setInIsrael(inIsrael);
  return jc.isYomTovAssurBemelacha();
}

/** Candle/havdalah/fast events for a specific date (computes that date's zmanim). */
function dayEventsFor(
  date: DateTime,
  location: AppLocation,
  candleLightingOffset: number,
  havdalahOpinion: HavdalahOpinion,
): DayEvent[] {
  const z = computeZmanim({
    lat: location.lat,
    lng: location.lng,
    date,
    timeZoneId: location.timeZoneId,
    candleLightingOffset,
  });
  const byKey = Object.fromEntries(z.map((x) => [x.key, x.time]));
  return getDayEvents(
    date,
    {
      candleLighting: byKey.candleLighting,
      alos: byKey.alosHashachar,
      sunset: byKey.sunset,
      tzais: byKey.tzais,
      havdalah: havdalahTime(havdalahOpinion, byKey),
    },
    location.inIsrael,
  );
}

/**
 * Candle lighting + havdalah for the whole rest period (Shabbat / Yom Tov) the
 * selected day belongs to — so both bookend times show on the eve AND on the
 * rest day(s) — plus any same-day fast events.
 */
function buildDayTimes(
  selectedDay: DateTime,
  location: AppLocation,
  candleLightingOffset: number,
  havdalahOpinion: HavdalahOpinion,
): DayEvent[] {
  const inIsrael = location.inIsrael;
  const bookends: DayEvent[] = [];

  // Find the contiguous rest block the selected day is in, or the one starting tomorrow.
  let firstRest: DateTime | null = null;
  let lastRest: DateTime | null = null;
  if (isRestDay(selectedDay, inIsrael)) {
    firstRest = selectedDay;
    while (isRestDay(firstRest.minus({ days: 1 }), inIsrael)) firstRest = firstRest.minus({ days: 1 });
    lastRest = selectedDay;
    while (isRestDay(lastRest.plus({ days: 1 }), inIsrael)) lastRest = lastRest.plus({ days: 1 });
  } else if (isRestDay(selectedDay.plus({ days: 1 }), inIsrael)) {
    firstRest = selectedDay.plus({ days: 1 });
    lastRest = firstRest;
    while (isRestDay(lastRest.plus({ days: 1 }), inIsrael)) lastRest = lastRest.plus({ days: 1 });
  }

  if (firstRest && lastRest) {
    const erev = firstRest.minus({ days: 1 });
    const candle = dayEventsFor(erev, location, candleLightingOffset, havdalahOpinion).find((e) => e.type === 'candle');
    const havdalah = dayEventsFor(lastRest, location, candleLightingOffset, havdalahOpinion).find(
      (e) => e.type === 'havdalah',
    );
    if (candle) bookends.push(candle);
    if (havdalah) bookends.push(havdalah);
  }

  // Same-day fast events (minor fasts, Yom Kippur, Tisha B'Av).
  const fasts = dayEventsFor(selectedDay, location, candleLightingOffset, havdalahOpinion).filter(
    (e) => e.type === 'fastStart' || e.type === 'fastEnd',
  );

  return [...bookends, ...fasts];
}

interface Chip {
  key: string;
  label: string;
  tone: DayTone;
  Icon?: LucideIcon;
}

function DayChip({ label, tone, Icon }: Omit<Chip, 'key'>) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', DAY_TONE[tone].chip)}
    >
      {Icon && <Icon className="size-3 shrink-0" />}
      {label}
    </span>
  );
}

type Translator = (key: string, values?: Record<string, string | number>) => string;

/** Build the ordered set of significant-day chips for the selected day. */
function buildDayChips(info: DayInfo, locale: string, t: { cat: Translator; panel: Translator }): Chip[] {
  const chips: Chip[] = [];

  // The significant-day name. For Chanukah the formatter already includes the
  // day number (e.g. "Chanukah 3"), so we don't append it again.
  const festival = localizedHolidayLabel(locale, info.label, info.yomTovIndex, info.dayOfChanukah);

  if (info.dayOfChanukah > 0) {
    chips.push({
      key: 'chanukah',
      label: festival ?? `${t.cat('chanukah')} ${info.dayOfChanukah}`,
      tone: 'chanukah',
      Icon: Flame,
    });
  } else if (festival) {
    // Same tone as the grid dot for this day, so dot and chip always match.
    chips.push({ key: 'festival', label: festival, tone: significantTone(info.category, 0) });
  }

  if (info.isShabbos) chips.push({ key: 'shabbos', label: t.cat('shabbos'), tone: 'shabbat' });
  if (info.isRoshChodesh) chips.push({ key: 'roshChodesh', label: t.cat('roshChodesh'), tone: 'roshChodesh', Icon: Moon });
  if (info.isShabbosMevorchim)
    chips.push({ key: 'mevorchim', label: t.panel('shabbatMevarchim'), tone: 'mevorchim', Icon: Sparkles });
  if (info.omer > 0) chips.push({ key: 'omer', label: t.panel('omer', { day: info.omer }), tone: 'omer', Icon: Wheat });
  if (info.weekParsha)
    chips.push({ key: 'parsha', label: t.panel('parasha', { name: info.weekParsha }), tone: 'parsha', Icon: BookOpen });

  return chips;
}

export function ZmanimPanel() {
  const { selectedDay, location, candleLightingOffset, havdalahOpinion } = useAppState();
  const zmanim = useZmanim();
  const locale = useLocale();
  const tName = useTranslations('zmanim.names');
  const tShita = useTranslations('zmanim.shitot');
  const tDetail = useTranslations('zmanim.descriptions');
  const tBaseDesc = useTranslations('zmanim.baseDescriptions');
  const tGroup = useTranslations('zmanim.groups');
  const tCat = useTranslations('categories');
  const tPanel = useTranslations('panel');
  const tEvents = useTranslations('events');

  const info = getDayInfo(selectedDay, undefined, locale, location.inIsrael);

  const chips = buildDayChips(info, locale, { cat: tCat, panel: tPanel });

  // Candle lighting + havdalah for the rest period (both bookends on both days),
  // plus any fast times for the selected day.
  const events = buildDayTimes(selectedDay, location, candleLightingOffset, havdalahOpinion);

  // Candle lighting now lives in the events strip above, so keep it out of the
  // zmanim list to avoid showing the same time twice.
  const groups = buildZmanimGroups(
    zmanim.filter((z) => z.key !== 'candleLighting'),
    { name: tName, shita: tShita, detail: tDetail, baseDescription: tBaseDesc, group: tGroup },
  );

  return (
    <Card className="gap-0 py-0 lg:h-full">
      <CardHeader className="gap-1 px-5 py-3">
        <h3 className="text-lg font-semibold leading-tight">
          {selectedDay.setLocale(locale).toLocaleString({ weekday: 'long', month: 'long', day: 'numeric' })}
          <span className="text-muted-foreground ms-2 text-sm font-normal">
            {info.hebrewDayOfMonth} {info.hebrewMonth}
          </span>
        </h3>
        {chips.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {chips.map(({ key, ...chip }) => (
              <DayChip key={key} {...chip} />
            ))}
          </div>
        )}
        {events.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
            {events.map((event, i) => {
              const { Icon, className } = EVENT_META[event.type];
              return (
                <div key={`${event.type}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <Icon className={cn('size-4 shrink-0', className)} />
                    {tEvents(event.type)}
                    {event.type === 'candle' && (
                      <Badge variant="secondary" className="font-normal tabular-nums">
                        {tEvents('candleOffset', { minutes: candleLightingOffset })}
                      </Badge>
                    )}
                    {event.type === 'havdalah' && (
                      <Badge variant="secondary" className="font-normal tabular-nums">
                        {tShita(havdalahZmanKey(havdalahOpinion))}
                      </Badge>
                    )}
                  </span>
                  <time className="font-mono tabular-nums">{formatTime(event.time, locale)}</time>
                </div>
              );
            })}
          </div>
        )}
      </CardHeader>
      <Separator />
      <CardContent className="flex flex-col gap-3 px-5 py-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <ZmanimList groups={groups} locale={locale} />
      </CardContent>
    </Card>
  );
}
