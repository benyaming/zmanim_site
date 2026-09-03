'use client';

import { JewishCalendar } from 'kosher-zmanim';
import {
  BookOpen,
  CalendarClock,
  CalendarHeart,
  Clock,
  Flame,
  Moon,
  ScrollText,
  Sparkles,
  Utensils,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react';
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
import {
  DEFAULT_HIDDEN_FAST_END,
  dayEventZmanKeys,
  fastEndZmanKey,
  getDayEvents,
  getDayInfo,
  isErevPesach,
  isYomTovRestDay,
  localizedHolidayLabel,
  restBlockFor,
  type DayEvent,
  type DayEventType,
  type DayInfo,
  type RestBlock,
} from '@/lib/calendar';
import { type Observance, observancesOn } from '@/lib/personal-dates';
import { observanceChipText, type PersonalDatesTranslator } from '@/components/tools/personal-dates-labels';
import { formatMoladParts, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  applyLehumraToEvents,
  buildZmanimGroups,
  computeZmanim,
  isPolarDay,
  havdalahTime,
  havdalahZmanKey,
  type HavdalahOpinion,
} from '@/lib/zmanim';

import { DailyLearning } from './daily-learning';
import { InfoHint } from './info-hint';
import { ZmanimList } from './zmanim-list';

const EVENT_META: Record<DayEventType, { Icon: ComponentType<{ className?: string }>; className: string }> = {
  candle: { Icon: CandleFlames, className: 'text-amber-600 dark:text-amber-400' },
  havdalah: { Icon: Sparkles, className: 'text-violet-600 dark:text-violet-400' },
  fastStart: { Icon: UtensilsCrossed, className: 'text-rose-600 dark:text-rose-400' },
  fastEnd: { Icon: Utensils, className: 'text-emerald-600 dark:text-emerald-400' },
};

/**
 * A day event tagged with the civil date it belongs to. The panel lists the
 * whole rest block's bookends on every day of it (see buildDayTimes), so a row
 * often belongs to a different date than the selected one and has to say so.
 */
type DatedEvent = DayEvent & { date: DateTime };

/** Candle/havdalah/fast events for a specific date (computes that date's zmanim). */
function dayEventsFor(
  date: DateTime,
  location: AppLocation,
  candleLightingOffset: number,
  havdalahOpinion: HavdalahOpinion,
  useElevation: boolean,
  hiddenFastEnd: readonly string[] = DEFAULT_HIDDEN_FAST_END,
): DatedEvent[] {
  const z = computeZmanim({
    lat: location.lat,
    lng: location.lng,
    date,
    elevation: location.elevation,
    useElevation,
    timeZoneId: location.timeZoneId,
    candleLightingOffset,
    // Only event times are read here — not the full opinion list.
    keys: dayEventZmanKeys(havdalahZmanKey(havdalahOpinion)),
  });
  const byKey = Object.fromEntries(z.map((x) => [x.key, x.time]));
  const events = getDayEvents(
    date,
    {
      candleLighting: byKey.candleLighting,
      sunset: byKey.sunset,
      havdalah: havdalahTime(havdalahOpinion, byKey),
      zmanimByKey: byKey,
    },
    location.inIsrael,
    hiddenFastEnd,
  );
  return events.map((e) => ({ ...e, date }));
}

/** The times of one rest block, plus the block itself when it spans several nights. */
interface DayTimes {
  events: DatedEvent[];
  /**
   * Set only for a rest block of more than one day (a 2-day Yom Tov, Yom Tov
   * next to Shabbat): the eve that lights the first candles, plus the rest days
   * themselves (which name the block). Such a block lights candles more than
   * once — one per night a further rest day begins — so the rows are grouped
   * under a heading naming the block and each says which night it is;
   * otherwise identical "Candle lighting" rows sit next to each other with
   * nothing to tell them apart.
   */
  block: RestBlock | null;
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
  useElevation: boolean,
  hiddenFastEnd: readonly string[],
): DayTimes {
  const inIsrael = location.inIsrael;
  const bookends: DatedEvent[] = [];

  // The rest block the selected day is in, or the one starting tomorrow.
  const block = restBlockFor(selectedDay, inIsrael);

  if (block) {
    const candle = dayEventsFor(block.erev, location, candleLightingOffset, havdalahOpinion, useElevation).find(
      (e) => e.type === 'candle',
    );
    if (candle) bookends.push(candle);
    // Lightings INSIDE a multi-day block — one per night a further rest day
    // begins: the 2nd Yom Tov night (after nightfall), Yom Tov on Motzei
    // Shabbat (after nightfall), or Shabbat after a Friday Yom Tov (regular
    // pre-sunset time). Chronological between the erev candle and havdalah.
    for (let day = block.firstRest; day.toMillis() < block.lastRest.toMillis(); day = day.plus({ days: 1 })) {
      const nightCandle = dayEventsFor(day, location, candleLightingOffset, havdalahOpinion, useElevation).find(
        (e) => e.type === 'candle',
      );
      if (nightCandle) bookends.push(nightCandle);
    }
    const havdalah = dayEventsFor(block.lastRest, location, candleLightingOffset, havdalahOpinion, useElevation).find(
      (e) => e.type === 'havdalah',
    );
    if (havdalah) bookends.push(havdalah);
  }

  // Same-day fast events (minor fasts, Yom Kippur, Tisha B'Av).
  let fasts = dayEventsFor(
    selectedDay,
    location,
    candleLightingOffset,
    havdalahOpinion,
    useElevation,
    hiddenFastEnd,
  ).filter((e) => e.type === 'fastStart' || e.type === 'fastEnd');

  // Tisha B'Av spans two civil days (sunset on the eve → nightfall), so show
  // BOTH its bookends on both days, mirroring the rest-day bookends above.
  // Yom Kippur needs nothing here: as a rest day its onset/end already appear
  // on both days as candle lighting / havdalah. (Minor fasts are dawn→nightfall
  // within one day.)
  const isTishaBav = (d: DateTime) => {
    const jc = new JewishCalendar(d);
    jc.setInIsrael(inIsrael);
    return jc.getYomTovIndex() === JewishCalendar.TISHA_BEAV;
  };
  if (isTishaBav(selectedDay)) {
    // The day itself: prepend the onset (yesterday's sunset) from the eve.
    const eve = dayEventsFor(selectedDay.minus({ days: 1 }), location, candleLightingOffset, havdalahOpinion, useElevation);
    const start = eve.find((e) => e.type === 'fastStart');
    if (start) fasts = [start, ...fasts];
  } else if (isTishaBav(selectedDay.plus({ days: 1 }))) {
    // The eve: append tomorrow's fast-end times after tonight's onset.
    const day = dayEventsFor(
      selectedDay.plus({ days: 1 }),
      location,
      candleLightingOffset,
      havdalahOpinion,
      useElevation,
      hiddenFastEnd,
    );
    fasts = [...fasts, ...day.filter((e) => e.type === 'fastEnd')];
  }

  // Only a multi-day block needs the grouping: a lone Shabbat has one candle
  // lighting and one havdalah, which name themselves.
  return { events: [...bookends, ...fasts], block: block?.multiDay ? block : null };
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

  // A special Shabbat ("Shabbat Hagadol", "Shabbat Shuva", …) replaces the
  // plain "Shabbat" chip rather than doubling it.
  if (info.specialShabbos) {
    chips.push({ key: 'shabbos', label: t.panel('specialShabbat', { name: info.specialShabbos }), tone: 'shabbat' });
  } else if (info.isShabbos) {
    chips.push({ key: 'shabbos', label: t.cat('shabbos'), tone: 'shabbat' });
  }
  if (info.isRoshChodesh) chips.push({ key: 'roshChodesh', label: t.cat('roshChodesh'), tone: 'roshChodesh', Icon: Moon });
  if (info.isShabbosMevorchim)
    chips.push({ key: 'mevorchim', label: t.panel('shabbatMevarchim'), tone: 'mevorchim', Icon: Sparkles });
  if (info.omer > 0) chips.push({ key: 'omer', label: t.panel('omer', { day: info.omer }), tone: 'omer', Icon: Wheat });
  if (info.weekParsha)
    chips.push({ key: 'parsha', label: t.panel('parasha', { name: info.weekParsha }), tone: 'parsha', Icon: BookOpen });

  return chips;
}

/**
 * "Fri 11" — which night a bookend row belongs to. Composed through the catalog
 * so each locale sets the order (the weekday itself comes from Luxon).
 */
function dayLabel(date: DateTime, locale: string, t: Translator): string {
  return t('eventDay', { weekday: date.setLocale(locale).toLocaleString({ weekday: 'short' }), day: date.day });
}

/**
 * What to call a multi-day rest block: the distinct significant-day names of
 * its days — "Rosh Hashana" for the two-day chag, "Shabbat · Shavuot" when a
 * Yom Tov abuts Shabbat. A Shabbat that is itself Yom Tov is named by the
 * festival alone, not twice.
 *
 * The festival name is taken only when the day is a work-prohibited Yom Tov.
 * `info.label` is the formatter's significant-day name, which also fires on
 * Erev Yom Tov, Chol Hamoed and Isru Chag — inside a rest block those days are
 * always Shabbatot, and naming them by the neighbouring festival would print
 * "Erev Pesach · Pesach", or a Shabbat as "Isru Chag", and never say Shabbat.
 */
function restBlockName(
  firstRest: DateTime,
  lastRest: DateTime,
  locale: string,
  inIsrael: boolean,
  tCat: Translator,
): string {
  const names: string[] = [];
  for (let d = firstRest; d.toMillis() <= lastRest.toMillis(); d = d.plus({ days: 1 })) {
    const info = getDayInfo(d, undefined, locale, inIsrael);
    const festival = isYomTovRestDay(d, inIsrael)
      ? localizedHolidayLabel(locale, info.label, info.yomTovIndex, info.dayOfChanukah)
      : null;
    const name = festival ?? (info.isShabbos ? tCat('shabbos') : null);
    if (name && !names.includes(name)) names.push(name);
  }
  return names.join(' · ');
}

/** A masthead chip for a personal-date observance on the selected day. */
function observanceToChip(obs: Observance, t: PersonalDatesTranslator): Chip {
  return { key: `pd-${obs.sourceId}-${obs.kind}`, label: observanceChipText(obs, t), tone: 'custom', Icon: CalendarHeart };
}

export function ZmanimPanel() {
  const {
    selectedDay,
    location,
    candleLightingOffset,
    havdalahOpinion,
    hiddenZmanim,
    hiddenFastEnd,
    useElevation,
    lehumra,
    personalDates,
  } = useAppState();
  const zmanim = useZmanim();
  const locale = useLocale();
  const tName = useTranslations('zmanim.names');
  const tShita = useTranslations('zmanim.shitot');
  const tDetail = useTranslations('zmanim.descriptions');
  const tBaseDesc = useTranslations('zmanim.baseDescriptions');
  const tGroup = useTranslations('zmanim.groups');
  const tFamily = useTranslations('zmanim.families');
  const tFamilyDesc = useTranslations('zmanim.familyDescriptions');
  const tZmanim = useTranslations('zmanim');
  const tCat = useTranslations('categories');
  const tPanel = useTranslations('panel');
  const tEvents = useTranslations('events');
  const tPersonal = useTranslations('personalDates');

  const info = getDayInfo(selectedDay, undefined, locale, location.inIsrael);

  const chips = buildDayChips(info, locale, { cat: tCat, panel: tPanel });
  // Both calendars' anniversaries can coincide (an un-shifted birth) and produce
  // the same text — collapse exact duplicates.
  const seenCustom = new Set<string>();
  for (const obs of observancesOn(selectedDay, personalDates)) {
    const chip = observanceToChip(obs, tPersonal);
    if (seenCustom.has(chip.label)) continue;
    seenCustom.add(chip.label);
    chips.push(chip);
  }

  // Candle lighting + havdalah for the rest period (both bookends on both days),
  // plus any fast times for the selected day. Lehumra rounds per event type
  // (fast start DOWN although its clock time is alot, which rounds up as a
  // zman row), so it applies here rather than inside computeZmanim.
  const { events: rawEvents, block } = buildDayTimes(
    selectedDay,
    location,
    candleLightingOffset,
    havdalahOpinion,
    useElevation,
    hiddenFastEnd,
  );
  const events = lehumra ? applyLehumraToEvents(rawEvents) : rawEvents;
  // The rest block's bookends, then the fast rows. A multi-day block's bookends
  // are grouped under a heading and dated (repeated candle lightings otherwise
  // look like duplicates); the fast end arrives once per tzeit opinion and gets its
  // own grouped block instead of repeating the "Fast ends" row three times.
  const bookendEvents = events.filter((e) => e.type === 'candle' || e.type === 'havdalah');
  const fastStartEvents = events.filter((e) => e.type === 'fastStart');
  const fastEndEvents = events.filter((e) => e.type === 'fastEnd');

  // Candle lighting now lives in the events strip above, so keep it out of the
  // zmanim list to avoid showing the same time twice. User-hidden zmanim are
  // filtered here (display only) — events above still use the full computation.
  // The chametz deadlines only surface on Erev Pesach itself.
  const hidden = new Set(hiddenZmanim);
  const erevPesach = isErevPesach(selectedDay);
  const groups = buildZmanimGroups(
    zmanim.filter(
      (z) => z.key !== 'candleLighting' && !hidden.has(z.key) && (!z.erevPesachOnly || erevPesach),
    ),
    {
      name: tName,
      shita: tShita,
      detail: tDetail,
      baseDescription: tBaseDesc,
      familyLabel: tFamily,
      familyDescription: tFamilyDesc,
      group: tGroup,
    },
  );

  /**
   * One event row: icon, the night it belongs to (only inside a multi-day
   * block, where rows span several days), name, how the time is derived, time.
   */
  const renderEvent = (event: DatedEvent, key: string, showDate: boolean) => {
    const { Icon, className } = EVENT_META[event.type];
    return (
      <div key={key} className="flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-medium">
          <Icon className={cn('size-4 shrink-0', className)} />
          {showDate && (
            <span className="text-muted-foreground text-xs font-normal">{dayLabel(event.date, locale, tEvents)}</span>
          )}
          {tEvents(event.type)}
          {event.type === 'candle' && (
            <Badge variant="secondary" className="font-normal tabular-nums">
              {event.afterNightfall
                ? tEvents('candleAfterNightfall')
                : tEvents('candleOffset', { minutes: candleLightingOffset })}
            </Badge>
          )}
          {event.type === 'havdalah' && (
            <Badge variant="secondary" className="font-normal tabular-nums">
              {tShita(havdalahZmanKey(havdalahOpinion))}
            </Badge>
          )}
          {/* Which dawn the fast starts at — usually 16.1°, but the
              fixed-72-minute one where the sun never reaches 16.1°. */}
          {event.type === 'fastStart' && event.zmanKey && (
            <Badge variant="secondary" className="font-normal tabular-nums">
              {tShita(event.zmanKey)}
            </Badge>
          )}
        </span>
        <time className="shrink-0 font-mono font-medium tabular-nums">{formatTime(event.time, locale)}</time>
      </div>
    );
  };

  return (
    <Card className="gap-0 py-0 lg:h-full">
      {/* Masthead: the day's identity on a tinted band — date pair, chips,
          molad and the headline times all live here; everything below is the
          uniform ruled-section body. */}
      <CardHeader className="bg-muted/30 gap-1 px-5 py-3">
        <h3 className="flex flex-wrap items-baseline justify-between gap-x-3 text-lg font-semibold leading-tight">
          {selectedDay.setLocale(locale).toLocaleString({ weekday: 'long', month: 'long', day: 'numeric' })}
          <span className="text-muted-foreground text-sm font-medium">
            {info.hebrewDayOfMonth} {info.hebrewMonth}
          </span>
        </h3>
        {(chips.length > 0 || lehumra) && (
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {chips.map(({ key, ...chip }) => (
              <DayChip key={key} {...chip} />
            ))}
            {/* Mode indicator, not a day fact — muted outline so it reads as
                state, unlike the tinted holiday chips. The info popover holds
                the full per-zman rounding rules. */}
            {lehumra && (
              <span className="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
                <Clock className="size-3 shrink-0" />
                {tPanel('lehumraChip')}
                <InfoHint detail={tPanel('lehumraDetail')} label={tPanel('lehumraChip')} />
              </span>
            )}
          </div>
        )}
        {/* An observance kept off its nominal date (fast nidche, the Israeli
            national days) — say so, so the "wrong"-looking date isn't a puzzle. */}
        {info.observedShift && (
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
            <CalendarClock className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            {tPanel(info.observedShift === 'postponed' ? 'observedPostponed' : 'observedAdvanced')}
          </p>
        )}
        {/* Yizkor: the memorial prayer is said on four festival days (two of
            them on a different date in Israel), and people plan around it. */}
        {info.isYizkor && (
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
            <ScrollText className="size-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
            {tPanel('yizkor')}
            <InfoHint detail={tPanel('yizkorDetail')} label={tPanel('yizkorLabel')} />
          </p>
        )}
        {info.molad && (
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
            <Moon className="size-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
            {tPanel('molad', { ...formatMoladParts(info.molad, locale), chalakim: info.molad.chalakim })}
          </p>
        )}
        {events.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-1.5">
            {/* A rest block of several nights lights candles once per night a
                further rest day begins — the 2nd Yom Tov night, Shabbat after a
                Friday Yom Tov, or both (three lightings on a Thu+Fri Yom Tov
                running into Shabbat). Grouping the bookends under the block's
                name and dating each row says which night is which; a lone
                Shabbat needs neither. */}
            {block ? (
              <div>
                <span className="text-muted-foreground text-xs font-medium">
                  {tEvents('blockHeading', {
                    name: restBlockName(block.firstRest, block.lastRest, locale, location.inIsrael, tCat),
                    from: dayLabel(block.erev, locale, tEvents),
                    to: dayLabel(block.lastRest, locale, tEvents),
                  })}
                </span>
                <div className="border-border mt-1 flex flex-col gap-1.5 border-s ps-2.5">
                  {bookendEvents.map((event, i) => renderEvent(event, `${event.type}-${i}`, true))}
                </div>
              </div>
            ) : (
              bookendEvents.map((event, i) => renderEvent(event, `${event.type}-${i}`, false))
            )}
            {fastStartEvents.map((event, i) => renderEvent(event, `fastStart-${i}`, false))}
            {/* Fast end comes once per tzeit opinion — one labeled block with a
                compact row per opinion, like a multi-shita zman in the list. */}
            {fastEndEvents.length > 0 && (
              <div>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <EVENT_META.fastEnd.Icon className={cn('size-4 shrink-0', EVENT_META.fastEnd.className)} />
                  {tEvents('fastEnd')}
                </span>
                <div className="mt-1 space-y-1 ps-6">
                  {fastEndEvents.map((event) => (
                    <div key={event.zmanKey} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground text-xs">{event.zmanKey ? tShita(fastEndZmanKey(event.zmanKey)) : ''}</span>
                      <time className="font-mono text-sm tabular-nums">{formatTime(event.time, locale)}</time>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <Separator />
      <CardContent className="flex flex-col gap-4 px-5 py-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <DailyLearning date={selectedDay} inIsrael={location.inIsrael} locale={locale} />
        <ZmanimList
          groups={groups}
          locale={locale}
          noDegreeTimeNote={isPolarDay(zmanim) ? '' : tZmanim('noDegreeTimeNote')}
          footnote={
            <>
              {lehumra && (
                <p className="flex items-center gap-1">
                  <span>{tPanel('lehumraNote')}</span>
                  <InfoHint detail={tPanel('lehumraDetail')} label={tPanel('lehumraChip')} />
                </p>
              )}
              <p>{tPanel('zmanimSettingsHint')}</p>
            </>
          }
        />
      </CardContent>
    </Card>
  );
}
