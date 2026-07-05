'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { DateTime, Info as LuxonInfo } from 'luxon';
import { flushSync } from 'react-dom';
import { useEffect, useRef, useState, type CSSProperties, type RefObject, type TouchEvent } from 'react';

import { useAccessibility } from '@/components/providers/accessibility-provider';
import { useAppState } from '@/components/providers/app-state';
import { dirForLocale } from '@/i18n/routing';
import {
  buildMonthGrid,
  type CalendarMode,
  createHebrewFormatter,
  getDayEvents,
  getDayInfo,
  localizedHolidayLabel,
  nextMonth,
  prevMonth,
} from '@/lib/calendar';
import { type AppLocation } from '@/lib/location';
import { applyLehumraToEvents, computeZmanim, type HavdalahOpinion, havdalahTime } from '@/lib/zmanim';

import { CalendarDay, type CellChip, type CellDensity } from './calendar-day';

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
// Safety slack against sub-pixel rounding of the `1fr` row tracks and the
// applied scale — without it an exact-fit cell can clip its last line by a
// hairline.
const FIT_SLACK_PX = 1;

// Touch-swipe month navigation. A gesture locks to an axis after AXIS_LOCK_PX
// of travel; only horizontal gestures drag the month strip (vertical stays
// native page scroll — the wrapper is touch-action: pan-y), so scrolling and
// taps on day cells never flip the month. The strip follows the finger 1:1
// with the adjacent months rendered alongside; releasing past
// SWIPE_COMMIT_FRACTION of the width — or a quick flick — commits the change.
const AXIS_LOCK_PX = 10;
const SWIPE_COMMIT_FRACTION = 0.3;
/** px/ms of release velocity: a flick this fast commits even on a short drag. */
const FLICK_VELOCITY = 0.4;
/** Even a flick must travel this far, so a twitchy tap can't change month. */
const FLICK_MIN_PX = 24;
const SETTLE_MS = 260;
const SETTLE_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

const SWIPE_HINT_KEY = 'zmanim:swipe-hint:v1';

/**
 * Show the one-time swipe-onboarding hint: touch-capable device, never shown
 * before. Read directly (not in an effect) — the app shell only renders this
 * after mount, so there's no SSR pass to disagree with.
 */
function shouldShowSwipeHint(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.matchMedia('(any-pointer: coarse)').matches && !('ontouchstart' in window)) return false;
  try {
    return window.localStorage.getItem(SWIPE_HINT_KEY) === null;
  } catch {
    return false;
  }
}

/** Everything a day cell's content depends on, besides the date itself. */
interface DayRenderCfg {
  locale: string;
  /** Translated Rosh Chodesh chip label — derived from `locale`, so not part of the cache key. */
  roshChodeshLabel: string;
  location: AppLocation;
  candleLightingOffset: number;
  havdalahOpinion: HavdalahOpinion;
  useElevation: boolean;
  lehumra: boolean;
}

// The formatter only depends on the locale — reuse it across renders and months.
const formatterCache = new Map<string, ReturnType<typeof createHebrewFormatter>>();
function formatterFor(locale: string): ReturnType<typeof createHebrewFormatter> {
  let f = formatterCache.get(locale);
  if (!f) {
    f = createHebrewFormatter(locale);
    formatterCache.set(locale, f);
  }
  return f;
}

function computeDayRender(date: DateTime, cfg: DayRenderCfg) {
  const { locale, location } = cfg;
  const info = getDayInfo(date, formatterFor(locale), locale, location.inIsrael);
  const label = localizedHolidayLabel(locale, info.label, info.yomTovIndex, info.dayOfChanukah);
  // A day can carry two markers (Chanukah on Rosh Chodesh) — show both rather
  // than letting one win.
  const chips: CellChip[] = [];
  if (label) chips.push({ label, category: info.category });
  if (info.isRoshChodesh && !(label && info.category === 'roshChodesh')) {
    chips.push({ label: cfg.roshChodeshLabel, category: 'roshChodesh' });
  }

  const zmanim = computeZmanim({
    lat: location.lat,
    lng: location.lng,
    date,
    elevation: location.elevation,
    useElevation: cfg.useElevation,
    timeZoneId: location.timeZoneId,
    candleLightingOffset: cfg.candleLightingOffset,
  });
  const byKey = Object.fromEntries(zmanim.map((z) => [z.key, z.time]));
  // A cell only has room for one fast-end time — keep the earliest opinion
  // (Geonim 5.95°); the day panel shows all three.
  const rawEvents = getDayEvents(
    date,
    {
      candleLighting: byKey.candleLighting,
      alos: byKey.alosHashachar,
      sunset: byKey.sunset,
      tzaisGeonim: byKey.tzaisGeonim,
      tzais: byKey.tzais,
      tzais42: byKey.tzais42,
      havdalah: havdalahTime(cfg.havdalahOpinion, byKey),
    },
    location.inIsrael,
  ).filter((e) => e.type !== 'fastEnd' || e.zmanKey === 'tzaisGeonim');
  const events = cfg.lehumra ? applyLehumraToEvents(rawEvents) : rawEvents;

  return { info, chips, events };
}

// Computing a day (zmanim + info + events) is the expensive part of rendering
// a month, and with the swipe pager three months are live at once. The result
// is a pure function of (date, cfg), so cache it module-wide: revisiting a
// month — swiping back and forth, or toggling civil/Hebrew, which shifts the
// same days between panels — costs nothing, and only genuinely new months
// compute. ~4 months × 42 cells per settings-variant fits comfortably.
const DAY_CACHE_MAX = 600;
const dayCache = new Map<string, ReturnType<typeof computeDayRender>>();

function getCachedDayRender(date: DateTime, cfg: DayRenderCfg): ReturnType<typeof computeDayRender> {
  const l = cfg.location;
  const key = [
    date.toISODate(),
    cfg.locale,
    l.lat,
    l.lng,
    l.elevation,
    l.timeZoneId,
    l.inIsrael,
    cfg.candleLightingOffset,
    cfg.havdalahOpinion,
    cfg.useElevation,
    cfg.lehumra,
  ].join('|');
  const hit = dayCache.get(key);
  if (hit) return hit;
  const value = computeDayRender(date, cfg);
  if (dayCache.size >= DAY_CACHE_MAX) {
    // Evict the oldest chunk (Map preserves insertion order).
    let drop = 64;
    for (const k of dayCache.keys()) {
      dayCache.delete(k);
      if (--drop === 0) break;
    }
  }
  dayCache.set(key, value);
  return value;
}

/** Fill the day cache for a whole month, so its panel later renders from cache. */
function warmMonth(monthDate: DateTime, mode: CalendarMode, cfg: DayRenderCfg): void {
  for (const cell of buildMonthGrid(monthDate, mode).cells) getCachedDayRender(cell.date, cfg);
}

interface CellFit {
  density: CellDensity;
  scale: number;
}

/**
 * Decide, from the measured cell size and content, how much each cell shows and
 * how much to shrink it so it fits without clipping:
 *  · Width picks the base tier (compact → medium → full) — horizontal room.
 *  · In the fixed-viewport (lg+) layout the rows are a height-constrained `1fr`,
 *    so the content is scaled down (via a width-compensated transform — see
 *    `fitStyle` in {@link CalendarDay}) to fit the tallest cell's real
 *    content. Only if it would have to shrink past {@link MIN_SCALE} does the
 *    tier step down.
 * Below lg the grid is content-sized, so height never constrains (scale stays 1).
 *
 * The content height is measured with the width reset to its natural value,
 * so the measurement is independent of the currently applied scale — applying a
 * new fit can't change the next measurement, and there's no oscillation. Tiers
 * that haven't been rendered yet use {@link ESTIMATED_NEED_REM}; choosing one
 * re-renders, which re-runs the effect (`fit.density` dep) and measures it for
 * real. Measuring in rem folds in the accessibility text scaling; the
 * `fontScale` dep re-measures when the scale changes but the element size
 * doesn't, and the `contentKey` dep re-measures when the month's content
 * changes without the grid resizing.
 *
 * The observed element is the swipe wrapper, but both the reference cell and
 * the natural-height pass read only the center month panel — a side panel can
 * have a different week count (row height), and measuring one panel instead of
 * three keeps the forced-layout pass cheap on slow devices. The side panels
 * adopt the center's fit; in the rare case a neighbour's tallest cell is
 * taller it can clip transiently mid-swipe, and corrects the moment it becomes
 * the center (the contentKey change re-measures).
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
      const cell = el.querySelector<HTMLElement>('[data-panel="center"] [data-day-cell]');
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
      // rendered. The fit's inflated width is reset during the read so the
      // result doesn't depend on the currently applied scale (the transform
      // itself never affects offsetHeight). Wrapping at the natural width is
      // never looser than at the inflated width, so this can only
      // overestimate — content never clips. The cache is invalidated on every
      // input that could change the result (content, font scale, cell width,
      // tier), so a hit — e.g. a height-only resize — skips the whole
      // write/read pass.
      if (cache.need[rendered] === undefined) {
        const wrappers = Array.from(el.querySelectorAll<HTMLElement>('[data-panel="center"] [data-day-content]'));
        const saved = wrappers.map((n) => n.style.getPropertyValue('width'));
        for (const n of wrappers) n.style.removeProperty('width');
        let needPx = 0;
        for (const n of wrappers) needPx = Math.max(needPx, n.offsetHeight);
        wrappers.forEach((n, i) => saved[i] && n.style.setProperty('width', saved[i]));
        cache.need[rendered] = needPx / rem;
      }

      const cellStyle = getComputedStyle(cell);
      const availRem =
        (cell.clientHeight - parseFloat(cellStyle.paddingTop) - parseFloat(cellStyle.paddingBottom) - FIT_SLACK_PX) /
        rem;

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

type PanelPosition = 'leading' | 'center' | 'trailing';

/**
 * One month rendered as a full grid (weekday headers + day cells). The center
 * panel sits in normal flow and defines the height; the side panels are
 * absolutely positioned one full width to each logical side (plus a 1px seam
 * of the wrapper's bg-border), so dragging the strip reveals them like pages.
 */
function MonthPanel({
  monthDate,
  position,
  density,
  scale,
  todayIso,
  cfg,
}: {
  monthDate: DateTime;
  position: PanelPosition;
  density: CellDensity;
  scale: number;
  todayIso: string;
  cfg: DayRenderCfg;
}) {
  const { mode, selectedDay, setSelectedDay } = useAppState();

  const headers = weekdayHeaders(cfg.locale);

  // Build the grid and pull each day's info + events from the module cache.
  // The React Compiler memoizes this on monthDate/mode/cfg, so it does NOT
  // recompute on every selected-day change — and since panels are keyed by
  // month, a committed swipe reuses the two already-rendered months as-is.
  const grid = buildMonthGrid(monthDate, mode);
  const days = grid.cells.map((cell) => ({
    cell,
    iso: cell.date.toISODate() ?? '',
    ...getCachedDayRender(cell.date, cfg),
  }));

  return (
    <div
      data-panel={position}
      className={
        'bg-border grid grid-cols-7 gap-px ' +
        // Mobile: compact, content-sized rows (page scrolls). Desktop: fill the
        // available height with equal rows so the whole month always fits.
        '[grid-template-rows:auto_repeat(var(--weeks),minmax(2.75rem,auto))] ' +
        'lg:h-full lg:[grid-template-rows:auto_repeat(var(--weeks),minmax(0,1fr))]' +
        (position === 'center'
          ? ''
          : ' absolute inset-y-0 w-full' +
            (position === 'leading'
              ? ' [inset-inline-start:calc(-100%_-_1px)]'
              : ' [inset-inline-start:calc(100%_+_1px)]'))
      }
      style={{ '--weeks': grid.weeks } as CSSProperties}
    >
      {headers.map((name) => (
        <div key={name} className="bg-card text-muted-foreground px-1 py-1.5 text-center text-xs font-medium">
          {name}
        </div>
      ))}
      {days.map(({ cell, iso, info, chips, events }) => (
        <CalendarDay
          key={iso}
          date={cell.date}
          inMonth={cell.inMonth}
          info={info}
          chips={chips}
          events={events}
          mode={mode}
          locale={cfg.locale}
          density={density}
          scale={scale}
          isSelected={cell.date.hasSame(selectedDay, 'day')}
          isToday={iso === todayIso}
          onSelect={setSelectedDay}
        />
      ))}
    </div>
  );
}

export function CalendarGrid() {
  const {
    monthDate,
    mode,
    setMonthDate,
    location,
    candleLightingOffset,
    havdalahOpinion,
    useElevation,
    lehumra,
  } = useAppState();
  const { fontScale } = useAccessibility();
  const locale = useLocale();
  const t = useTranslations('calendar');
  const tCat = useTranslations('categories');

  const cfg: DayRenderCfg = {
    locale,
    roshChodeshLabel: tCat('roshChodesh'),
    location,
    candleLightingOffset,
    havdalahOpinion,
    useElevation,
    lehumra,
  };

  // The side panels only matter once a swipe starts, so the initial render pays
  // for one month, not three — on slow devices that's the difference between a
  // snappy and a sluggish first paint. They mount when the browser goes idle
  // (or at the first touch, whichever comes first).
  const [sidesReady, setSidesReady] = useState(false);
  useEffect(() => {
    if (sidesReady) return;
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => setSidesReady(true));
      return () => window.cancelIdleCallback(id);
    }
    // Safari (incl. iOS) has no requestIdleCallback — give the first paint a beat.
    const id = window.setTimeout(() => setSidesReady(true), 200);
    return () => window.clearTimeout(id);
  }, [sidesReady]);

  // Each cell shows compact / medium / full detail — and shrinks to fit — based
  // on its measured size and content. Everything that changes what the cells
  // render (and so their measured height) is folded into the key.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentKey = [
    monthDate.toISODate(),
    mode,
    locale,
    location.lat,
    location.lng,
    location.timeZoneId,
    location.elevation,
    candleLightingOffset,
    havdalahOpinion,
    useElevation,
    lehumra,
  ].join('|');
  const { density, scale } = useCellFit(wrapperRef, fontScale, contentKey);

  // Swipe left/right on a touchscreen to move a month; the three-month strip
  // follows the finger 1:1. Touch events only fire on touch input, so this is
  // inert with a mouse. In RTL the "next" month sits visually to the left, so
  // the commit direction flips with the header chevrons.
  const rtl = dirForLocale(locale) === 'rtl';

  // One-time discoverability hint: the calendar wiggles and a caption pill
  // fades in/out. Dismissed for good once the animation has played or the user
  // has swiped for real — whichever comes first.
  const [showHint, setShowHint] = useState(shouldShowSwipeHint);
  const dismissHint = () => {
    setShowHint(false);
    try {
      window.localStorage.setItem(SWIPE_HINT_KEY, '1');
    } catch {
      // Best-effort — without storage the hint just replays next visit.
    }
  };

  // Drag feedback mutates the strip's inline transform directly — per-frame
  // state would re-render every cell on each touchmove. React never writes
  // these properties, so they stick until cleared here.
  const stripRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; lastX: number; lastT: number; vx: number } | null>(
    null,
  );
  // True while a committed swipe's settle transition plays; new touches are
  // ignored for that beat so the month swap isn't torn mid-flight.
  const settlingRef = useRef(false);
  const setStripX = (px: number, animate: boolean) => {
    const el = stripRef.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${SETTLE_MS}ms ${SETTLE_EASING}` : 'none';
    el.style.transform = px === 0 ? '' : `translateX(${px}px)`;
  };
  // Coalesce touchmove writes to one per frame — on old devices touch events
  // can outpace the display, and each stray write is a wasted style pass.
  const pendingXRef = useRef<number | null>(null);
  const moveRafRef = useRef(0);
  const scheduleStripX = (px: number) => {
    pendingXRef.current = px;
    if (moveRafRef.current) return;
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = 0;
      if (pendingXRef.current !== null) setStripX(pendingXRef.current, false);
      pendingXRef.current = null;
    });
  };
  const cancelScheduledStripX = () => {
    pendingXRef.current = null;
    if (moveRafRef.current) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = 0;
    }
  };
  // The strip is only layer-promoted while a swipe is in flight: a permanent
  // will-change keeps a three-month-wide texture in GPU memory, which is
  // exactly what hurts old devices.
  const releaseWillChange = () => {
    window.setTimeout(() => {
      if (!settlingRef.current && !dragRef.current && stripRef.current) stripRef.current.style.willChange = '';
    }, SETTLE_MS + 50);
  };
  /** One panel-to-panel hop in px: the wrapper width plus the 1px seam. */
  const hopWidth = () => (wrapperRef.current?.clientWidth ?? 0) + 1;

  const onTouchStart = (e: TouchEvent) => {
    if (settlingRef.current) return;
    // A touch is the strongest hint a swipe is coming — make sure the side
    // panels exist before the finger travels far enough to reveal them.
    if (!sidesReady) setSidesReady(true);
    dragRef.current =
      e.touches.length === 1
        ? {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            axis: null,
            lastX: e.touches[0].clientX,
            lastT: performance.now(),
            vx: 0,
          }
        : null;
    // A second finger (pinch/zoom) cancels an in-flight drag.
    if (!dragRef.current) {
      cancelScheduledStripX();
      setStripX(0, true);
      releaseWillChange();
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (e.touches.length !== 1) {
      dragRef.current = null;
      cancelScheduledStripX();
      setStripX(0, true);
      releaseWillChange();
      return;
    }
    const x = e.touches[0].clientX;
    const dx = x - drag.x;
    const dy = e.touches[0].clientY - drag.y;
    if (!drag.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_PX) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.axis === 'x') {
        if (stripRef.current) stripRef.current.style.willChange = 'transform';
        // The user is already swiping — retire the hint (its CSS animation
        // would also override the strip transform while it plays).
        if (showHint) dismissHint();
      }
    }
    if (drag.axis !== 'x') return;
    // Release velocity is a lightly smoothed px/ms from the recent samples, so
    // a pause at the end of the drag reads as "stopped", not as the peak speed.
    const now = performance.now();
    if (now > drag.lastT) drag.vx = 0.8 * ((x - drag.lastX) / (now - drag.lastT)) + 0.2 * drag.vx;
    drag.lastX = x;
    drag.lastT = now;
    const w = hopWidth();
    scheduleStripX(Math.max(-w, Math.min(w, dx)));
  };

  const onTouchEnd = (e: TouchEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.axis !== 'x') return;
    cancelScheduledStripX();
    const dx = e.changedTouches[0].clientX - drag.x;
    const w = hopWidth();
    const flick = Math.abs(drag.vx) >= FLICK_VELOCITY && Math.sign(drag.vx) === Math.sign(dx);
    const commit = Math.abs(dx) >= w * SWIPE_COMMIT_FRACTION || (flick && Math.abs(dx) >= FLICK_MIN_PX);
    if (!commit || w === 1) {
      setStripX(0, true);
      releaseWillChange();
      return;
    }
    const forward = rtl ? dx > 0 : dx < 0;
    const target = forward ? nextMonth(monthDate, mode) : prevMonth(monthDate, mode);
    // Warm the month that becomes the new neighbour while the settle
    // transition plays — the transition runs on the compositor, so this
    // main-thread work can't stutter it, and the post-swap render then
    // finds the whole month already in the day cache.
    const upcoming = forward ? nextMonth(target, mode) : prevMonth(target, mode);
    window.setTimeout(() => warmMonth(upcoming, mode, cfg), 0);
    // Finish the slide onto the revealed panel, then swap the month state and
    // snap the strip back to center in the same frame — the panel that was
    // sliding in is now the center one, so nothing moves on screen.
    const el = stripRef.current;
    if (!el) {
      setMonthDate(target);
      return;
    }
    settlingRef.current = true;
    const finish = () => {
      if (!settlingRef.current) return;
      settlingRef.current = false;
      el.removeEventListener('transitionend', finish);
      flushSync(() => setMonthDate(target));
      el.style.transition = 'none';
      el.style.transform = '';
      releaseWillChange();
    };
    el.addEventListener('transitionend', finish);
    // Fallback: transitionend can be swallowed (tab switch, reduced motion
    // rounding) — never leave the calendar stuck between months.
    setTimeout(finish, SETTLE_MS + 120);
    setStripX(Math.sign(dx) * w, true);
  };

  const onTouchCancel = () => {
    dragRef.current = null;
    cancelScheduledStripX();
    setStripX(0, true);
    releaseWillChange();
  };

  // Safe to call now() here: the app shell gates rendering until mounted, so
  // this only runs on the client (no SSR hydration mismatch).
  const todayIso = DateTime.now().toISODate() ?? '';

  const months: { month: DateTime; position: PanelPosition }[] = sidesReady
    ? [
        { month: prevMonth(monthDate, mode), position: 'leading' },
        { month: monthDate, position: 'center' },
        { month: nextMonth(monthDate, mode), position: 'trailing' },
      ]
    : [{ month: monthDate, position: 'center' }];

  return (
    <div
      ref={wrapperRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      className={
        'bg-border relative touch-pan-y overflow-hidden rounded-xl border lg:min-h-0 lg:flex-1' +
        (showHint ? ' animate-swipe-hint' : '')
      }
    >
      <div ref={stripRef} className="relative lg:h-full">
        {months.map(({ month, position }) => (
          <MonthPanel
            key={`${mode}:${month.toISODate()}`}
            monthDate={month}
            position={position}
            density={density}
            scale={scale}
            todayIso={todayIso}
            cfg={cfg}
          />
        ))}
      </div>
      {showHint && (
        <div
          // The fade outlasts the wiggle, so its end is the hint's end.
          onAnimationEnd={(e) => {
            if (e.animationName === 'swipe-hint-fade') dismissHint();
          }}
          className="animate-swipe-hint-fade pointer-events-none absolute inset-0 z-10 flex items-end justify-center pb-[15%] opacity-0"
        >
          <div className="bg-foreground/80 text-background flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg">
            <ChevronLeft className="size-4" aria-hidden />
            {t('swipeHint')}
            <ChevronRight className="size-4" aria-hidden />
          </div>
        </div>
      )}
    </div>
  );
}
