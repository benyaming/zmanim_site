'use client';

import { useLocale, useTranslations } from 'next-intl';
import { DateTime, Info as LuxonInfo } from 'luxon';
import type { CSSProperties } from 'react';

import { useAccessibility } from '@/components/providers/accessibility-provider';
import { useAppState } from '@/components/providers/app-state';
import { buildMonthGrid, createHebrewFormatter, getDayEvents, getDayInfo, localizedHolidayLabel } from '@/lib/calendar';
import { computeZmanim } from '@/lib/zmanim';

import { CalendarDay } from './calendar-day';

/** Sunday-first localized short weekday names. */
function weekdayHeaders(locale: string): string[] {
  const names = LuxonInfo.weekdays('short', { locale }); // Mon..Sun
  return [names[6], ...names.slice(0, 6)];
}

export function CalendarGrid() {
  const { monthDate, mode, selectedDay, setSelectedDay, location, candleLightingOffset } = useAppState();
  const { fontScale } = useAccessibility();
  const locale = useLocale();
  const tCat = useTranslations('categories');

  // At the largest text size, even desktop cells can't fit their full content in
  // the fixed viewport — so they fall back to the compact (mobile-style) view:
  // big day number + a significant-day dot, with details in the side panel.
  const compact = fontScale === 'xxl';

  const headers = weekdayHeaders(locale);

  // Build the grid and compute each day's info + events once. The React Compiler
  // memoizes this on monthDate/mode/locale/location, so it does NOT recompute on
  // every selected-day change.
  const grid = buildMonthGrid(monthDate, mode);
  const formatter = createHebrewFormatter(locale === 'he');
  const days = grid.cells.map((cell) => {
    const info = getDayInfo(cell.date, formatter, locale, location.inIsrael);
    const label = localizedHolidayLabel(locale, info.label, info.yomTovIndex, info.dayOfChanukah);
    const chipLabel = label ?? (info.isRoshChodesh ? tCat('roshChodesh') : null);

    const zmanim = computeZmanim({
      lat: location.lat,
      lng: location.lng,
      date: cell.date,
      timeZoneId: location.timeZoneId,
      candleLightingOffset,
    });
    const byKey = Object.fromEntries(zmanim.map((z) => [z.key, z.time]));
    const events = getDayEvents(
      cell.date,
      {
        candleLighting: byKey.candleLighting,
        alos: byKey.alosHashachar,
        sunset: byKey.sunset,
        tzais: byKey.tzais,
      },
      location.inIsrael,
    );

    return { cell, info, chipLabel, events };
  });

  // Safe to call now() here: the app shell gates rendering until mounted, so
  // this only runs on the client (no SSR hydration mismatch).
  const today = DateTime.now();

  return (
    <div
      className={
        'bg-border grid grid-cols-7 gap-px overflow-hidden rounded-xl border ' +
        // Mobile: compact, content-sized rows (page scrolls). Desktop: fill the
        // available height with equal rows so the whole month always fits.
        '[grid-template-rows:auto_repeat(var(--weeks),minmax(2.75rem,auto))] ' +
        'lg:min-h-0 lg:flex-1 lg:[grid-template-rows:auto_repeat(var(--weeks),minmax(0,1fr))]'
      }
      style={{ '--weeks': grid.weeks } as CSSProperties}
    >
      {headers.map((name) => (
        <div key={name} className="bg-card text-muted-foreground px-1 py-1.5 text-center text-xs font-medium">
          {name}
        </div>
      ))}
      {days.map(({ cell, info, chipLabel, events }) => (
        <CalendarDay
          key={cell.date.toISODate()}
          date={cell.date}
          inMonth={cell.inMonth}
          info={info}
          chipLabel={chipLabel}
          events={events}
          mode={mode}
          locale={locale}
          compact={compact}
          isSelected={cell.date.hasSame(selectedDay, 'day')}
          isToday={cell.date.hasSame(today, 'day')}
          onSelect={setSelectedDay}
        />
      ))}
    </div>
  );
}
