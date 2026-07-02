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
// First-pass estimate of each tier's content height. Only used until a tier has
// been rendered once — after that its real height is measured from the DOM
// (which, unlike a constant, accounts for wrapped labels and the locale).
const ESTIMATED_NEED_REM: Record<CellDensity, number> = { full: 5.4, medium: 3.7, compact: 2.4 };
const TIER_ORDER: CellDensity[] = ['full', 'medium', 'compact'];
const MIN_SCALE = 0.72; // don't shrink text past this before dropping a tier

interface CellFit {
  density: CellDensity;
  scale: number;
}

/**
 * Decide, from the measured cell size and content, how much each cell shows and
 * how much to shrink it so it fits without clipping:
 *  · Width picks the base tier (compact → medium → full) — horizontal room.
 *  · In the fixed-viewport (lg+) layout the rows are a height-constrained `1fr`,
 *    so the content is scaled down (via `zoom`) to fit the tallest cell's real
 *    content. Only if it would have to shrink past {@link MIN_SCALE} does the
 *    tier step down.
 * Below lg the grid is content-sized, so height never constrains (scale stays 1).
 *
 * The content height is measured with zoom/width reset to their natural values,
 * so the measurement is independent of the currently applied scale — applying a
 * new fit can't change the next measurement, and there's no oscillation. Tiers
 * that haven't been rendered yet use {@link ESTIMATED_NEED_REM}; choosing one
 * re-renders, which re-runs the effect (`fit.density` dep) and measures it for
 * real. Measuring in rem folds in the accessibility text scaling; the
 * `fontScale` dep re-measures when the scale changes but the element size
 * doesn't, and the `contentKey` dep re-measures when the month's content
 * changes without the grid resizing.
 */
function useCellFit(gridRef: RefObject<HTMLDivElement | null>, fontScale: string, contentKey: string): CellFit {
  const [fit, setFit] = useState<CellFit>({ density: 'full', scale: 1 });
  // Measured natural content height (rem) per rendered tier, valid for one
  // content + cell-width + font-scale combination.
  const measuredRef = useRef<{ key: string; width: number; need: Partial<Record<CellDensity, number>> }>({
    key: '',
    width: 0,
    need: {},
  });
  const rendered = fit.density;
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // ResizeObserver fires once on observe, so no synchronous setState is needed.
    const ro = new ResizeObserver(() => {
      const cell = el.querySelector<HTMLElement>('[data-day-cell]');
      if (!cell || cell.clientWidth === 0) return;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const w = cell.clientWidth / rem;
      const widthTier: CellDensity =
        w < MEDIUM_MIN_WIDTH_REM ? 'compact' : w < FULL_MIN_WIDTH_REM ? 'medium' : 'full';

      if (!window.matchMedia('(min-width: 1024px)').matches) {
        setFit((prev) => (prev.density === widthTier && prev.scale === 1 ? prev : { density: widthTier, scale: 1 }));
        return;
      }

      const cache = measuredRef.current;
      const cacheKey = `${contentKey}|${fontScale}`;
      if (cache.key !== cacheKey || Math.abs(cache.width - w) > 0.01) {
        cache.key = cacheKey;
        cache.width = w;
        cache.need = {};
      }

      // Natural height of the tallest cell's content for the tier currently
      // rendered. zoom is reset during the read so the result doesn't depend
      // on the currently applied scale. (Wrapping at natural width is never
      // looser than at the zoomed width, so this can only overestimate —
      // content never clips.)
      const wrappers = Array.from(el.querySelectorAll<HTMLElement>('[data-day-content]'));
      const saved = wrappers.map((n) => n.style.getPropertyValue('zoom'));
      for (const n of wrappers) n.style.setProperty('zoom', '1');
      let needPx = 0;
      for (const n of wrappers) needPx = Math.max(needPx, n.offsetHeight);
      wrappers.forEach((n, i) => n.style.setProperty('zoom', saved[i]));
      cache.need[rendered] = needPx / rem;

      const cellStyle = getComputedStyle(cell);
      const availRem =
        (cell.clientHeight - parseFloat(cellStyle.paddingTop) - parseFloat(cellStyle.paddingBottom) - 1) / rem;

      // Densest tier (from the width baseline down) that fits the row without
      // shrinking past MIN_SCALE.
      let next: CellFit = { density: 'compact', scale: MIN_SCALE };
      for (let i = TIER_ORDER.indexOf(widthTier); i < TIER_ORDER.length; i++) {
        const tier = TIER_ORDER[i];
        const scale = Math.min(1, availRem / (cache.need[tier] ?? ESTIMATED_NEED_REM[tier]));
        if (scale >= MIN_SCALE || i === TIER_ORDER.length - 1) {
          next = { density: tier, scale: Math.max(MIN_SCALE, scale) };
          break;
        }
      }
      setFit((prev) =>
        prev.density === next.density && Math.abs(prev.scale - next.scale) < 0.01 ? prev : next,
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridRef, fontScale, contentKey, rendered]);
  return fit;
}

export function CalendarGrid() {
  const { monthDate, mode, selectedDay, setSelectedDay, location, candleLightingOffset, havdalahOpinion } =
    useAppState();
  const { fontScale } = useAccessibility();
  const locale = useLocale();
  const tCat = useTranslations('categories');

  // Each cell shows compact / medium / full detail — and shrinks to fit — based
  // on its measured size and content. Everything that changes what the cells
  // render (and so their measured height) is folded into the key.
  const gridRef = useRef<HTMLDivElement>(null);
  const contentKey = [
    monthDate.toISODate(),
    mode,
    locale,
    location.lat,
    location.lng,
    location.timeZoneId,
    candleLightingOffset,
    havdalahOpinion,
  ].join('|');
  const { density, scale } = useCellFit(gridRef, fontScale, contentKey);

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
