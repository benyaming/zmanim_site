'use client';

import { useLocale, useTranslations } from 'next-intl';
import { DateTime, Info as LuxonInfo } from 'luxon';
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

import { useAccessibility } from '@/components/providers/accessibility-provider';
import { useAppState } from '@/components/providers/app-state';
import { buildMonthGrid, createHebrewFormatter, getDayEvents, getDayInfo, localizedHolidayLabel } from '@/lib/calendar';
import { computeZmanim, havdalahTime } from '@/lib/zmanim';

import { CalendarDay, type CellDensity } from './calendar-day';

/** Sunday-first localized short weekday names. */
function weekdayHeaders(locale: string): string[] {
  const names = LuxonInfo.weekdays('short', { locale }); // Mon..Sun
  return [names[6], ...names.slice(0, 6)];
}

// Cell-size thresholds (in rem, so they track the accessibility text scale).
const MEDIUM_MIN_WIDTH_REM = 4; // narrower than this only a number + dot fits
const FULL_MIN_WIDTH_REM = 6; // narrower than this the omer/parsha lines don't fit
// Content height each tier needs at scale 1 (measured against the busiest months).
const CONTENT_NEED_REM: Record<CellDensity, number> = { full: 5.4, medium: 3.7, compact: 2.4 };
const TIER_ORDER: CellDensity[] = ['full', 'medium', 'compact'];
const MIN_SCALE = 0.72; // don't shrink text past this before dropping a tier

interface CellFit {
  density: CellDensity;
  scale: number;
}

/**
 * Decide, from the *measured* cell size, how much each cell shows and how much to
 * shrink it so it fits without clipping:
 *  · Width picks the base tier (compact → medium → full) — horizontal room.
 *  · In the fixed-viewport (lg+) layout the rows are a height-constrained `1fr`,
 *    so the content is scaled down (via `zoom`) to fit that height. Only if it
 *    would have to shrink past {@link MIN_SCALE} does the tier step down.
 * Below lg the grid is content-sized, so height never constrains (scale stays 1).
 *
 * Both dimensions are viewport-driven (column width and the `1fr` track), never
 * content-driven, so changing tier/scale can't change the measurement — no
 * oscillation. Measuring in rem folds in the accessibility text scaling; the
 * `fontScale` dep re-measures when the scale changes but the element size doesn't.
 */
function useCellFit(gridRef: RefObject<HTMLDivElement | null>, fontScale: string): CellFit {
  const [fit, setFit] = useState<CellFit>({ density: 'full', scale: 1 });
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    // ResizeObserver fires once on observe, so no synchronous setState is needed.
    const ro = new ResizeObserver(() => {
      const cell = el.children[7] as HTMLElement | undefined; // 7 weekday headers precede the day cells
      if (!cell || cell.clientWidth === 0) return;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const w = cell.clientWidth / rem;
      let density: CellDensity = w < MEDIUM_MIN_WIDTH_REM ? 'compact' : w < FULL_MIN_WIDTH_REM ? 'medium' : 'full';
      let scale = 1;
      if (window.matchMedia('(min-width: 1024px)').matches) {
        const h = cell.clientHeight / rem;
        // Shrink to fit the row; step the tier down only when we'd shrink too far.
        for (let i = TIER_ORDER.indexOf(density); i < TIER_ORDER.length; i++) {
          density = TIER_ORDER[i];
          scale = h / CONTENT_NEED_REM[density];
          if (scale >= MIN_SCALE || i === TIER_ORDER.length - 1) break;
        }
        scale = Math.max(MIN_SCALE, Math.min(1, scale));
      }
      setFit((prev) =>
        prev.density === density && Math.abs(prev.scale - scale) < 0.01 ? prev : { density, scale },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridRef, fontScale]);
  return fit;
}

export function CalendarGrid() {
  const { monthDate, mode, selectedDay, setSelectedDay, location, candleLightingOffset, havdalahOpinion } =
    useAppState();
  const { fontScale } = useAccessibility();
  const locale = useLocale();
  const tCat = useTranslations('categories');

  // Each cell shows compact / medium / full detail — and shrinks to fit — based on
  // its measured size.
  const gridRef = useRef<HTMLDivElement>(null);
  const { density, scale } = useCellFit(gridRef, fontScale);

  const headers = weekdayHeaders(locale);

  // Build the grid and compute each day's info + events once. The React Compiler
  // memoizes this on monthDate/mode/locale/location, so it does NOT recompute on
  // every selected-day change.
  const grid = buildMonthGrid(monthDate, mode);
  const formatter = createHebrewFormatter(locale);
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
        havdalah: havdalahTime(havdalahOpinion, byKey),
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
      ref={gridRef}
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
          density={density}
          scale={scale}
          isSelected={cell.date.hasSame(selectedDay, 'day')}
          isToday={cell.date.hasSame(today, 'day')}
          onSelect={setSelectedDay}
        />
      ))}
    </div>
  );
}
