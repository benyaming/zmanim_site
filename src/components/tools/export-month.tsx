'use client';

import { BookOpen, Sparkles, Utensils, UtensilsCrossed } from 'lucide-react';
import type { DateTime } from 'luxon';
import type { ComponentType } from 'react';

import { categoryChipClass } from '@/components/calendar/day-style';
import { CandleFlames } from '@/components/icons/candle-flames';
import {
  buildMonthGrid,
  type CalendarMode,
  createHebrewFormatter,
  type DayCategory,
  type DayEventType,
  DEFAULT_HIDDEN_FAST_END,
  dayEventZmanKeys,
  getDayEvents,
  getDayInfo,
  localizedHolidayLabel,
} from '@/lib/calendar';
import { type CustomDate, type CustomDateKind, occurrencesOn } from '@/lib/custom-dates';
import { alternateMonthsTitle, monthTitle, PAGE_HEIGHT_PX, PAGE_WIDTH_PX, weekdayHeaders } from '@/lib/export';
import { formatDuration, formatTime } from '@/lib/format';
import { getDailyLearning, LEARNING_CYCLE_KEYS, type LearningCycleKey } from '@/lib/learning';
import type { AppLocation } from '@/lib/location';
import {
  applyLehumraToEvents,
  computeZmanim,
  isPolarDay,
  type HavdalahOpinion,
  havdalahTime,
  havdalahZmanKey,
  roundTimeLehumra,
  ZMANIM,
  zmanLehumraDirection,
} from '@/lib/zmanim';
import { cn } from '@/lib/utils';

/** Page styles for the grid export: the app's day colors, ink-saving black & white, or the dark theme. */
export type ExportGridTheme = 'color' | 'mono' | 'dark';
export const EXPORT_GRID_THEMES: readonly ExportGridTheme[] = ['color', 'mono', 'dark'];

/** Max items (zmanim + learnings) shown per day cell — beyond this it's too dense. */
export const MAX_CELL_ITEMS = 5;

const LEARNING_KEY_SET: ReadonlySet<string> = new Set(LEARNING_CYCLE_KEYS);
const ZMAN_BY_KEY = new Map(ZMANIM.map((z) => [z.key, z]));
/** Sort key: zmanim first (chronological), then learnings — regardless of pick order. */
function cellItemOrder(key: string): number {
  const learn = LEARNING_CYCLE_KEYS.indexOf(key as LearningCycleKey);
  if (learn >= 0) return 1000 + learn;
  const zi = ZMANIM.findIndex((z) => z.key === key);
  return zi < 0 ? 900 : zi;
}
/** Canonical cell-item order (a subset of zman keys and learning keys, ≤ MAX_CELL_ITEMS). */
export function orderCellItems(keys: readonly string[]): string[] {
  return [...keys].sort((a, b) => cellItemOrder(a) - cellItemOrder(b));
}

export interface ExportMonthCfg {
  locale: string;
  location: AppLocation;
  candleLightingOffset: number;
  havdalahOpinion: HavdalahOpinion;
  useElevation: boolean;
  lehumra: boolean;
  /** Personal dates to overlay on the grid (empty unless the user opted in). */
  customDates: CustomDate[];
  /** Zmanim and/or learning cycles to show in each day cell (≤ MAX_CELL_ITEMS). */
  cellItemKeys: string[];
  /** Translated labels the cells need (resolved by the caller, which has hooks). */
  labels: {
    roshChodesh: string;
    mevarchim: string;
    omer: (day: number) => string;
    specialShabbat: (name: string) => string;
    /** Fallback name for an unlabeled personal date, by kind. */
    customDate: (kind: CustomDateKind) => string;
    /** Compact cell label for a zman base (zmanim.abbr). */
    zmanAbbr: (base: string) => string;
    /** Compact cell label for a learning cycle (learning.abbr). */
    learningAbbr: (key: string) => string;
    /** Legend text for a zman key — full name plus its shita. */
    zmanLegend: (key: string) => string;
    /** Full name of a learning cycle (for the legend). */
    learningName: (key: string) => string;
    /** Footnote when a chosen cell zman is blank on a short night. */
    noTimeNote: string;
    /** Footnote when elevation adjustment is on ({meters}). */
    noteElevation: (meters: number) => string;
    /** Footnote when lehumra rounding is on. */
    noteLehumra: string;
  };
}

/** One line inside a day cell: a compact label and its value (a time, duration or reading). */
interface CellItem {
  label: string;
  value: string;
}

interface ExportCell {
  iso: string;
  primary: number | string;
  secondary: string;
  inMonth: boolean;
  category: DayCategory;
  chips: { label: string; category: DayCategory; custom?: boolean }[];
  events: { type: DayEventType; time: string }[];
  /** The chosen zmanim/learnings for the day, pinned to the bottom of the cell. */
  items: CellItem[];
  omerLabel: string | null;
  parshaLine: string | null;
  mevarchimLabel: string | null;
}

export interface ExportMonthData {
  title: string;
  subtitle: string;
  headers: string[];
  weeks: number;
  cells: ExportCell[];
  /** Short-label → full name (+ shita) key for the cell items, shown under the grid. */
  legend: { label: string; full: string }[];
  /** Footnote when any cell holds a short-night blank, else null. */
  noTimeNote: string | null;
  /** Elevation / lehumra conditions applied to the times, joined; null if none. */
  conditions: string | null;
}

/**
 * Resolve one month into plain render data (mirrors the interactive grid's
 * per-cell computation at "full" density). Pure — safe to call outside React.
 */
export function buildExportMonth(monthDate: DateTime, mode: CalendarMode, cfg: ExportMonthCfg): ExportMonthData {
  const { locale, location } = cfg;
  const formatter = createHebrewFormatter(locale);
  const grid = buildMonthGrid(monthDate, mode);

  // Split the chosen cell items (canonical order) into zmanim and learnings.
  const orderedItems = orderCellItems(cfg.cellItemKeys);
  const cellZmanKeys = orderedItems.filter((k) => !LEARNING_KEY_SET.has(k));
  const cellLearningKeys = orderedItems.filter((k): k is LearningCycleKey => LEARNING_KEY_SET.has(k));
  // Track whether any chosen cell zman is a short-night blank (null while the
  // day still has a sunrise/sunset), so a footnote can explain the empty cells
  // the way the day panel's info hint does on screen.
  let anyShortNightBlank = false;

  const cells = grid.cells.map((cell) => {
    const date = cell.date;
    const info = getDayInfo(date, formatter, locale, location.inIsrael);
    const label = localizedHolidayLabel(locale, info.label, info.yomTovIndex, info.dayOfChanukah);
    const chips: ExportCell['chips'] = [];
    if (label) chips.push({ label, category: info.category });
    if (info.isRoshChodesh && !(label && info.category === 'roshChodesh')) {
      chips.push({ label: cfg.labels.roshChodesh, category: 'roshChodesh' });
    }
    for (const occ of occurrencesOn(date, cfg.customDates)) {
      chips.push({ label: occ.entry.label.trim() || cfg.labels.customDate(occ.entry.kind), category: 'weekday', custom: true });
    }

    // Compute the event keys plus any zmanim the user chose to show in the cell.
    const zmanim = computeZmanim({
      lat: location.lat,
      lng: location.lng,
      date,
      elevation: location.elevation,
      useElevation: cfg.useElevation,
      timeZoneId: location.timeZoneId,
      candleLightingOffset: cfg.candleLightingOffset,
      keys: new Set([...dayEventZmanKeys(havdalahZmanKey(cfg.havdalahOpinion)), ...cellZmanKeys]),
    });
    const byKey = Object.fromEntries(zmanim.map((z) => [z.key, z.time]));
    const zByKey = new Map(zmanim.map((z) => [z.key, z]));
    // Like the on-screen cells: one fast-end time only (the earliest opinion).
    const allEvents = getDayEvents(
      date,
      {
        candleLighting: byKey.candleLighting,
        sunset: byKey.sunset,
        havdalah: havdalahTime(cfg.havdalahOpinion, byKey),
        zmanimByKey: byKey,
      },
      location.inIsrael,
      DEFAULT_HIDDEN_FAST_END,
    );
    // One fast-end slot: the earliest opinion that HAS a time (on a short
    // night the degree opinions are null and the fixed-minute fallback wins).
    const fastEnds = allEvents.filter((e) => e.type === 'fastEnd');
    const chosenFastEnd = fastEnds.find((e) => e.time) ?? fastEnds[0];
    const rawEvents = allEvents.filter((e) => e.type !== 'fastEnd' || e === chosenFastEnd);
    const events = (cfg.lehumra ? applyLehumraToEvents(rawEvents) : rawEvents).map((e) => ({
      type: e.type,
      time: formatTime(e.time, locale),
    }));

    // Cell items, zmanim first (chronological) then learnings — pinned to the
    // bottom of the cell. Lehumra rounds each zman per its own direction (a
    // deadline down, an onset up). Durations render as h:mm:ss.
    const zmanItems: CellItem[] = cellZmanKeys.flatMap((key) => {
      const z = zByKey.get(key);
      if (!z) return [];
      const def = ZMAN_BY_KEY.get(key);
      const label = cfg.labels.zmanAbbr(def?.base ?? key);
      if (z.duration) return [{ label, value: formatDuration(z.durationMillis) }];
      if (z.time === null && !isPolarDay(zmanim)) anyShortNightBlank = true;
      const time = cfg.lehumra ? roundTimeLehumra(z.time, zmanLehumraDirection(key)) : z.time;
      return [{ label, value: formatTime(time, locale) }];
    });
    let learningItems: CellItem[] = [];
    if (cellLearningKeys.length > 0) {
      const readings = new Map(getDailyLearning(date, location.inIsrael, locale).map((l) => [l.key, l.reading]));
      learningItems = cellLearningKeys.map((key) => ({
        label: cfg.labels.learningAbbr(key),
        value: readings.get(key) ?? '',
      }));
    }

    const specialShabbosLabel = info.specialShabbos ? cfg.labels.specialShabbat(info.specialShabbos) : null;
    return {
      iso: date.toISODate() ?? '',
      primary: mode === 'hebrew' ? info.hebrewDayOfMonth : date.day,
      secondary:
        mode === 'hebrew'
          ? date.setLocale(locale).toLocaleString({ day: 'numeric', month: 'long' })
          : `${info.hebrewDayOfMonth} ${info.hebrewMonth}`,
      inMonth: cell.inMonth,
      category: info.category,
      chips,
      events,
      items: [...zmanItems, ...learningItems],
      omerLabel: info.omer > 0 ? cfg.labels.omer(info.omer) : null,
      parshaLine: [info.parsha, specialShabbosLabel].filter(Boolean).join(' · ') || null,
      mevarchimLabel: info.isShabbosMevorchim ? cfg.labels.mevarchim : null,
    };
  });

  // The short-label legend (same for every day): short label → full name (+ shita).
  const legend = [
    ...cellZmanKeys.map((key) => ({ label: cfg.labels.zmanAbbr(ZMAN_BY_KEY.get(key)?.base ?? key), full: cfg.labels.zmanLegend(key) })),
    ...cellLearningKeys.map((key) => ({ label: cfg.labels.learningAbbr(key), full: cfg.labels.learningName(key) })),
  ];

  // Compute-option footnotes (same for the whole export).
  const conditionParts: string[] = [];
  const elevation = location.elevation;
  if (cfg.useElevation && typeof elevation === 'number' && elevation > 0) {
    conditionParts.push(cfg.labels.noteElevation(elevation));
  }
  if (cfg.lehumra) conditionParts.push(cfg.labels.noteLehumra);

  const locationLabel = location.customLabel || location.label;
  return {
    title: monthTitle(monthDate, mode, locale),
    subtitle: `${alternateMonthsTitle(monthDate, mode, locale)} · ${locationLabel}`,
    headers: weekdayHeaders(locale),
    weeks: grid.weeks,
    cells,
    legend,
    noTimeNote: anyShortNightBlank ? cfg.labels.noTimeNote : null,
    conditions: conditionParts.length > 0 ? conditionParts.join(' · ') : null,
  };
}

const EVENT_ICON: Record<DayEventType, ComponentType<{ className?: string }>> = {
  candle: CandleFlames,
  havdalah: Sparkles,
  fastStart: UtensilsCrossed,
  fastEnd: Utensils,
};

// No `dark:` variants anywhere in the page — each theme picks its classes
// explicitly, so the app's own light/dark mode can never leak into a page.
// The `dark` theme instead puts the `.dark` class on the page ROOT, which
// re-declares every token var (bg-card, --day-*, …) with the dark palette.
const EVENT_COLOR: Record<DayEventType, string> = {
  candle: 'text-amber-600',
  havdalah: 'text-violet-600',
  fastStart: 'text-rose-600',
  fastEnd: 'text-emerald-600',
};
const EVENT_COLOR_DARK: Record<DayEventType, string> = {
  candle: 'text-amber-400',
  havdalah: 'text-violet-400',
  fastStart: 'text-rose-400',
  fastEnd: 'text-emerald-400',
};

/**
 * Per-theme page chrome (root surface, grid seams, the cell/section border
 * color, secondary text, header cells). `--border` (oklch 0.922) is too faint
 * to delineate dense cells in print, so the light themes use a clearer gray.
 */
const PAGE_THEME: Record<ExportGridTheme, { root: string; seam: string; border: string; muted: string; header: string }> = {
  color: { root: 'export-light bg-white text-neutral-900', seam: 'bg-neutral-300', border: 'border-neutral-300', muted: 'text-muted-foreground', header: 'bg-white' },
  mono: { root: 'export-light bg-white text-neutral-900', seam: 'bg-neutral-400', border: 'border-neutral-400', muted: 'text-neutral-600', header: 'bg-white' },
  dark: { root: 'dark bg-background text-foreground', seam: 'bg-border', border: 'border-border', muted: 'text-muted-foreground', header: 'bg-card' },
};

function eventColor(type: DayEventType, theme: ExportGridTheme): string {
  if (theme === 'mono') return 'text-neutral-700';
  return theme === 'dark' ? EVENT_COLOR_DARK[type] : EVENT_COLOR[type];
}

function cellClasses(cell: ExportCell, theme: ExportGridTheme): string {
  if (theme === 'mono') return cell.inMonth ? 'bg-white' : 'bg-neutral-100';
  // color + dark share the token classes — the dark root class flips the vars.
  if (!cell.inMonth) return 'bg-muted/40';
  if (cell.category === 'yomTov') return 'bg-day-yomtov-cell';
  if (cell.category === 'shabbos') return 'bg-day-shabbos';
  return 'bg-card';
}

function chipClasses(category: DayCategory, theme: ExportGridTheme): string {
  if (theme === 'mono') return 'border border-neutral-400 font-medium text-neutral-900';
  return cn(categoryChipClass(category), 'font-medium text-[color:var(--day-label)]');
}

/**
 * Personal-date chip styling — the app's teal tone, spelled out per theme (no
 * `dark:` variants; the dark page instead sets a `.dark` root, like the rest of
 * this file).
 */
const CUSTOM_CHIP: Record<ExportGridTheme, string> = {
  color: 'bg-teal-100 font-medium text-teal-800',
  mono: 'border border-neutral-400 font-medium text-neutral-900',
  dark: 'bg-teal-500/20 font-medium text-teal-200',
};

/** Body text size of the page at scale 1 — every em size below is relative to it. */
const BASE_FONT_PX = 11;

/**
 * One month as a fixed-size A4-landscape print page. Purely presentational —
 * rendered scaled-down as the dialog preview and 1:1 off-screen for the PDF.
 *
 * Sizes are px/em (not rem) on purpose: the page is a fixed print artifact
 * and must not follow the app's accessibility text scale. Text is em-based
 * against a root font size, so `textScale` grows the type without touching
 * the page geometry. The `export-light` root class pins the light theme
 * tokens even when the app runs dark, and no `dark:` variants are used
 * anywhere below it.
 */
export function ExportMonthPage({
  data,
  theme,
  dir,
  textScale = 1,
  footer,
}: {
  data: ExportMonthData;
  theme: ExportGridTheme;
  dir: 'ltr' | 'rtl';
  /** Multiplier on the page's type size (the appearance menu's scale steps). */
  textScale?: number;
  /** Attribution line at the bottom of the page. */
  footer: string;
}) {
  const { root, seam, border, muted, header } = PAGE_THEME[theme];

  return (
    <div
      data-export-page
      dir={dir}
      className={cn('flex flex-col p-[32px] font-sans', root)}
      style={{ width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX, fontSize: BASE_FONT_PX * textScale }}
    >
      <div className="mb-[16px] flex shrink-0 items-baseline justify-between gap-[16px]">
        <h1 className="text-[2.364em] leading-none font-semibold tracking-tight capitalize">{data.title}</h1>
        <p className={cn('text-[1.18em] leading-none', muted)}>{data.subtitle}</p>
      </div>

      <div
        className={cn('grid min-h-0 flex-1 grid-cols-7 gap-px overflow-hidden rounded-lg border', seam, border)}
        style={{ gridTemplateRows: `auto repeat(${data.weeks}, minmax(0, 1fr))` }}
      >
        {data.headers.map((name) => (
          <div key={name} className={cn('px-[4px] py-[6px] text-center text-[1.09em] font-medium', header, muted)}>
            {name}
          </div>
        ))}
        {data.cells.map((cell) => (
          <div
            key={cell.iso}
            className={cn('flex min-h-0 flex-col overflow-hidden p-[6px]', cellClasses(cell, theme))}
          >
            {/* Day identity + significant-day content; clips first so the pinned
                zmanim/learnings block below stays visible on a busy day. Every
                child is `shrink-0` so a full cell CLIPS from the bottom rather
                than flex-collapsing a chip to a thin (empty-looking) line. */}
            <div className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-hidden">
              <div className="flex shrink-0 items-baseline justify-between gap-[4px]">
                <span className={cn('shrink-0 text-[1.364em] font-semibold tabular-nums', !cell.inMonth && muted)}>
                  {cell.primary}
                </span>
                <span className={cn('min-w-0 truncate leading-tight', muted)}>{cell.secondary}</span>
              </div>
              {cell.chips.map((chip, i) => (
                <span
                  key={`${i}-${chip.label}`}
                  className={cn(
                    'line-clamp-2 shrink-0 rounded px-[4px] leading-tight',
                    chip.custom ? CUSTOM_CHIP[theme] : chipClasses(chip.category, theme),
                  )}
                >
                  {chip.label}
                </span>
              ))}
              {cell.events.length > 0 && (
                <div className="flex shrink-0 flex-col gap-[2px]">
                  {cell.events.map((event, i) => {
                    const Icon = EVENT_ICON[event.type];
                    return (
                      <span
                        key={`${event.type}-${i}`}
                        className="flex items-center gap-[4px] leading-tight font-medium tabular-nums"
                      >
                        <Icon className={cn('size-[1.09em] shrink-0', eventColor(event.type, theme))} />
                        {event.time}
                      </span>
                    );
                  })}
                </div>
              )}
              {cell.omerLabel && (
                <span className={cn('line-clamp-1 shrink-0 text-[0.909em] leading-tight', muted)}>{cell.omerLabel}</span>
              )}
              {cell.parshaLine && (
                <span className={cn('flex shrink-0 items-start gap-[4px] text-[0.909em] leading-tight', muted)}>
                  <BookOpen className="mt-px size-[1.2em] shrink-0" />
                  <span className="line-clamp-2 min-w-0">{cell.parshaLine}</span>
                </span>
              )}
              {cell.mevarchimLabel && (
                <span className={cn('flex shrink-0 items-start gap-[4px] text-[0.909em] leading-tight', muted)}>
                  <Sparkles className="mt-px size-[1.2em] shrink-0" />
                  <span className="line-clamp-1 min-w-0">{cell.mevarchimLabel}</span>
                </span>
              )}
            </div>
            {/* Chosen zmanim/learnings, bottom-aligned across the grid, above a
                thin separator. */}
            {cell.items.length > 0 && (
              <div className={cn('mt-[2px] flex shrink-0 flex-col gap-px border-t pt-[2px]', border)}>
                {cell.items.map((it, i) => (
                  <span
                    key={i}
                    className={cn('flex items-baseline justify-between gap-[4px] text-[0.833em] leading-none', muted)}
                  >
                    <span className="truncate">{it.label}</span>
                    <span className="shrink-0 tabular-nums">{it.value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="shrink-0 space-y-[2px] pt-[6px]">
        {/* Legend: the cells use short labels; this spells out each one (with its shita). */}
        {data.legend.length > 0 && (
          <p className={cn('text-[0.75em] leading-tight', muted)}>
            {data.legend.map((e, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                <span className="font-medium">{e.label}</span> — {e.full}
              </span>
            ))}
          </p>
        )}
        {data.noTimeNote && <p className={cn('text-[0.75em] leading-tight', muted)}>{data.noTimeNote}</p>}
        {data.conditions && <p className={cn('text-[0.75em] leading-tight', muted)}>{data.conditions}</p>}
        {/* Fixed px, not em: the attribution shouldn't grow with the text-size choice. */}
        <p className={cn('text-center text-[10px]', theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400')}>
          {footer}
        </p>
      </div>
    </div>
  );
}
