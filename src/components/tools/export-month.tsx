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
  getDayEvents,
  getDayInfo,
  localizedHolidayLabel,
} from '@/lib/calendar';
import { alternateMonthsTitle, monthTitle, PAGE_HEIGHT_PX, PAGE_WIDTH_PX, weekdayHeaders } from '@/lib/export';
import { formatTime } from '@/lib/format';
import type { AppLocation } from '@/lib/location';
import { applyLehumraToEvents, computeZmanim, type HavdalahOpinion, havdalahTime } from '@/lib/zmanim';
import { cn } from '@/lib/utils';

/** Page styles for the grid export: the app's day colors, ink-saving black & white, or the dark theme. */
export type ExportGridTheme = 'color' | 'mono' | 'dark';
export const EXPORT_GRID_THEMES: readonly ExportGridTheme[] = ['color', 'mono', 'dark'];

export interface ExportMonthCfg {
  locale: string;
  location: AppLocation;
  candleLightingOffset: number;
  havdalahOpinion: HavdalahOpinion;
  useElevation: boolean;
  lehumra: boolean;
  /** Translated labels the cells need (resolved by the caller, which has hooks). */
  labels: {
    roshChodesh: string;
    mevarchim: string;
    omer: (day: number) => string;
    specialShabbat: (name: string) => string;
  };
}

interface ExportCell {
  iso: string;
  primary: number | string;
  secondary: string;
  inMonth: boolean;
  category: DayCategory;
  chips: { label: string; category: DayCategory }[];
  events: { type: DayEventType; time: string }[];
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
}

/**
 * Resolve one month into plain render data (mirrors the interactive grid's
 * per-cell computation at "full" density). Pure — safe to call outside React.
 */
export function buildExportMonth(monthDate: DateTime, mode: CalendarMode, cfg: ExportMonthCfg): ExportMonthData {
  const { locale, location } = cfg;
  const formatter = createHebrewFormatter(locale);
  const grid = buildMonthGrid(monthDate, mode);

  const cells = grid.cells.map((cell) => {
    const date = cell.date;
    const info = getDayInfo(date, formatter, locale, location.inIsrael);
    const label = localizedHolidayLabel(locale, info.label, info.yomTovIndex, info.dayOfChanukah);
    const chips: ExportCell['chips'] = [];
    if (label) chips.push({ label, category: info.category });
    if (info.isRoshChodesh && !(label && info.category === 'roshChodesh')) {
      chips.push({ label: cfg.labels.roshChodesh, category: 'roshChodesh' });
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
    // Like the on-screen cells: one fast-end time only (earliest opinion).
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
    const events = (cfg.lehumra ? applyLehumraToEvents(rawEvents) : rawEvents).map((e) => ({
      type: e.type,
      time: formatTime(e.time, locale),
    }));

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
      omerLabel: info.omer > 0 ? cfg.labels.omer(info.omer) : null,
      parshaLine: [info.parsha, specialShabbosLabel].filter(Boolean).join(' · ') || null,
      mevarchimLabel: info.isShabbosMevorchim ? cfg.labels.mevarchim : null,
    };
  });

  const locationLabel = location.customLabel || location.label;
  return {
    title: monthTitle(monthDate, mode, locale),
    subtitle: `${alternateMonthsTitle(monthDate, mode, locale)} · ${locationLabel}`,
    headers: weekdayHeaders(locale),
    weeks: grid.weeks,
    cells,
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

/** Per-theme page chrome (root surface, grid seams, secondary text, header cells). */
const PAGE_THEME: Record<ExportGridTheme, { root: string; seam: string; muted: string; header: string }> = {
  color: { root: 'export-light bg-white text-neutral-900', seam: 'bg-border', muted: 'text-muted-foreground', header: 'bg-white' },
  mono: { root: 'export-light bg-white text-neutral-900', seam: 'bg-neutral-300', muted: 'text-neutral-600', header: 'bg-white' },
  dark: { root: 'dark bg-background text-foreground', seam: 'bg-border', muted: 'text-muted-foreground', header: 'bg-card' },
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
  const { root, seam, muted, header } = PAGE_THEME[theme];

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
        className={cn('grid min-h-0 flex-1 grid-cols-7 gap-px overflow-hidden rounded-lg border', seam)}
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
            className={cn('flex min-h-0 flex-col gap-[2px] overflow-hidden p-[6px]', cellClasses(cell, theme))}
          >
            <div className="flex items-baseline justify-between gap-[4px]">
              <span className={cn('shrink-0 text-[1.364em] font-semibold tabular-nums', !cell.inMonth && muted)}>
                {cell.primary}
              </span>
              <span className={cn('min-w-0 truncate leading-tight', muted)}>{cell.secondary}</span>
            </div>
            {cell.chips.map((chip) => (
              <span
                key={chip.label}
                className={cn('line-clamp-2 rounded px-[4px] leading-tight', chipClasses(chip.category, theme))}
              >
                {chip.label}
              </span>
            ))}
            {cell.events.length > 0 && (
              <div className="flex flex-col gap-[2px]">
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
              <span className={cn('line-clamp-1 text-[0.909em] leading-tight', muted)}>{cell.omerLabel}</span>
            )}
            {cell.parshaLine && (
              <span className={cn('flex items-start gap-[4px] text-[0.909em] leading-tight', muted)}>
                <BookOpen className="mt-px size-[1.2em] shrink-0" />
                <span className="line-clamp-2 min-w-0">{cell.parshaLine}</span>
              </span>
            )}
            {cell.mevarchimLabel && (
              <span className={cn('flex items-start gap-[4px] text-[0.909em] leading-tight', muted)}>
                <Sparkles className="mt-px size-[1.2em] shrink-0" />
                <span className="line-clamp-1 min-w-0">{cell.mevarchimLabel}</span>
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Fixed px, not em: the attribution shouldn't grow with the text-size choice. */}
      <p className={cn('shrink-0 pt-[8px] text-center text-[10px]', theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400')}>
        {footer}
      </p>
    </div>
  );
}
