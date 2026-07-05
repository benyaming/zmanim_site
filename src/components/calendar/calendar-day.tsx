'use client';

import { BookOpen, Sparkles, Utensils, UtensilsCrossed, Wheat } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DateTime } from 'luxon';
import type { ComponentType, CSSProperties } from 'react';

import { CandleFlames } from '@/components/icons/candle-flames';
import type { CalendarMode, DayCategory, DayEvent, DayEventType, DayInfo } from '@/lib/calendar';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { categoryChipClass, cellBackgroundClass, DAY_TONE, significantTone } from './day-style';

const EVENT_META: Record<DayEventType, { Icon: ComponentType<{ className?: string }>; className: string }> = {
  candle: { Icon: CandleFlames, className: 'text-amber-600 dark:text-amber-400' },
  havdalah: { Icon: Sparkles, className: 'text-violet-600 dark:text-violet-400' },
  fastStart: { Icon: UtensilsCrossed, className: 'text-rose-600 dark:text-rose-400' },
  fastEnd: { Icon: Utensils, className: 'text-emerald-600 dark:text-emerald-400' },
};


/**
 * How much a cell shows, chosen by the grid from the available cell size:
 *  · compact — day number + alternate-calendar date + a significant-day dot
 *              (narrow phone columns / very short viewports)
 *  · medium  — adds the significant-day label and candle/havdalah times
 *              (tablets and large phones)
 *  · full    — adds the omer count and the weekly parsha (roomy desktops)
 */
export type CellDensity = 'compact' | 'medium' | 'full';

/** A significant-day marker for a cell — a labeled chip in medium/full, a dot in compact. */
export interface CellChip {
  label: string;
  category: DayCategory;
}

interface CalendarDayProps {
  date: DateTime;
  inMonth: boolean;
  info: DayInfo;
  chips: CellChip[];
  events: DayEvent[];
  mode: CalendarMode;
  locale: string;
  density: CellDensity;
  /** Shrink factor (≤ 1) applied to the cell content so it fits a short row. */
  scale: number;
  isSelected: boolean;
  isToday: boolean;
  onSelect: (date: DateTime) => void;
}

export function CalendarDay({
  date,
  inMonth,
  info,
  chips,
  events,
  mode,
  locale,
  density,
  scale,
  isSelected,
  isToday,
  onSelect,
}: CalendarDayProps) {
  const tEvents = useTranslations('events');
  const tPanel = useTranslations('panel');
  const primary = mode === 'hebrew' ? info.hebrewDayOfMonth : date.day;
  const secondary =
    mode === 'hebrew'
      ? date.setLocale(locale).toLocaleString({ day: 'numeric', month: 'long' })
      : `${info.hebrewDayOfMonth} ${info.hebrewMonth}`;

  // The dot mirrors its chip's color; a Chanukah label keeps its Chanukah tone.
  const chipTone = (chip: CellChip) =>
    significantTone(chip.category, chip.category === 'weekday' ? info.dayOfChanukah : 0);

  const showLabels = density !== 'compact'; // medium + full
  const showExtras = density === 'full'; // omer + parsha

  // Shabbat qualifiers — plain muted text after the parsha (never chips above
  // the times), so the times stay vertically aligned across the week's cells.
  const specialShabbosLabel = info.specialShabbos ? tPanel('specialShabbat', { name: info.specialShabbos }) : null;
  const mevarchimLabel = info.isShabbosMevorchim ? tPanel('shabbatMevarchim') : null;
  // "Vaeschanan · Shabbat Nachamu" — the special-Shabbat name rides the parsha line.
  const parshaLine = [info.parsha, specialShabbosLabel].filter(Boolean).join(' · ') || null;

  // Shrink the content to fit a short row instead of clipping it: pre-inflate
  // the width by 1/scale, then transform-scale the subtree back down, so the
  // scaled result exactly fills the cell and text wraps as if the cell were
  // 1/scale larger. `zoom` would be the natural tool, but iOS WebKit resolves
  // rem lengths inside a zoomed subtree against an inversely-zoomed root font
  // size (WebKit bug 265869), and every size in a cell is rem-based (they must
  // track the accessibility text scale) — so on iPads zoom was a net no-op and
  // tall cells clipped. transform math is identical on every engine; the
  // scaled-down visual result stays inside the cell, and the (unscaled) layout
  // overflow is cut by the cell's `overflow-hidden`. The origin must be the
  // top inline-start corner (`origin-top-left rtl:origin-top-right` on the
  // wrapper) so the visual box hugs the cell's start edge in both directions.
  const fitStyle: CSSProperties | undefined =
    scale < 1 ? { width: `${100 / scale}%`, transform: `scale(${scale})` } : undefined;

  return (
    <button
      type="button"
      data-day-cell
      onClick={() => onSelect(date)}
      aria-pressed={isSelected}
      aria-current={isToday ? 'date' : undefined}
      className={cn(
        // flex (not block): buttons vertically center their content, which made
        // cells with less content sit lower than their row siblings.
        'flex h-full min-h-11 flex-col overflow-hidden p-1 text-start transition-colors sm:min-h-12',
        'focus-visible:ring-day-selected focus-visible:ring-2 focus-visible:outline-none',
        // Base: the day's category tint (dimmed for out-of-month padding days).
        cellBackgroundClass(info.category, !inMonth),
        !inMonth && 'text-muted-foreground',
        // Three distinct state mechanisms so they never look alike:
        //  · hover  → a transient neutral wash (only when not otherwise marked)
        //  · today  → a soft accent wash (ambient anchor; overrides category tint)
        //  · select → a crisp accent border (the active focus)
        !isToday && !isSelected && 'hover:bg-foreground/[0.06]',
        isToday && 'bg-day-selected/12',
        isSelected && 'ring-day-selected ring-2 ring-inset',
      )}
    >
      <div data-day-content className="flex origin-top-left flex-col gap-0.5 rtl:origin-top-right" style={fitStyle}>
        <div className="flex items-baseline justify-between gap-1">
        <span
          className={cn(
            'shrink-0 text-sm font-semibold tabular-nums transition-colors sm:text-base',
            // Today's / the selected day's number picks up the accent color.
            (isToday || isSelected) && 'text-day-selected font-bold',
          )}
        >
          {primary}
        </span>
        {showLabels && (
          <span className="text-muted-foreground min-w-0 truncate text-[0.6875rem] leading-tight">{secondary}</span>
        )}
      </div>

      {/* Compact: the alternate-calendar date sits below the number instead. */}
      {!showLabels && (
        <span className="text-muted-foreground truncate text-[0.625rem] leading-tight">{secondary}</span>
      )}

      {/* Compact: a dot per significant-day marker. */}
      {(chips.length > 0 || specialShabbosLabel || mevarchimLabel) && !showLabels && (
        <div className="flex gap-0.5" aria-hidden>
          {chips.map((chip) => (
            <span
              key={chip.label}
              className={cn('size-1.5 shrink-0 rounded-full', DAY_TONE[chipTone(chip)].dot)}
              title={chip.label}
            />
          ))}
          {specialShabbosLabel && (
            <span className={cn('size-1.5 shrink-0 rounded-full', DAY_TONE.shabbat.dot)} title={specialShabbosLabel} />
          )}
          {mevarchimLabel && (
            <span className={cn('size-1.5 shrink-0 rounded-full', DAY_TONE.mevorchim.dot)} title={mevarchimLabel} />
          )}
        </div>
      )}

      {/* Medium + full: the significant-day labels. Long names wrap (up to two
          lines) rather than clip — the grid's fit measurement absorbs the
          extra line. */}
      {showLabels &&
        chips.map((chip) => (
          <span
            key={chip.label}
            className={cn(
              'line-clamp-2 rounded px-1 text-[0.6875rem] leading-tight font-medium text-[color:var(--day-label)]',
              categoryChipClass(chip.category),
            )}
            title={chip.label}
          >
            {chip.label}
          </span>
        ))}

      {/* Medium + full: candle-lighting / havdalah / fast times. */}
      {events.length > 0 && showLabels && (
        <div className="flex flex-col gap-0.5">
          {events.map((event, i) => {
            const { Icon, className } = EVENT_META[event.type];
            return (
              <span
                key={`${event.type}-${i}`}
                className="flex items-center gap-1 text-[0.6875rem] leading-tight font-medium tabular-nums"
                title={tEvents(event.type)}
              >
                <Icon className={cn('size-3 shrink-0', className)} />
                {formatTime(event.time, locale)}
              </span>
            );
          })}
        </div>
      )}

      {/* Full only: the omer count. Wraps to a second line instead of clipping
          (`text-overflow` doesn't apply to flex containers, so `truncate` here
          used to cut the text with no ellipsis at all). */}
      {info.omer > 0 && showExtras && (
        <span
          className="text-muted-foreground flex items-start gap-1 text-[0.6875rem] leading-tight"
          title={tPanel('omer', { day: info.omer })}
        >
          <Wheat className="mt-px size-3 shrink-0" />
          <span className="line-clamp-2 min-w-0">{tPanel('omer', { day: info.omer })}</span>
        </span>
      )}

      {/* Full only: the weekly parsha, with the special-Shabbat name after it. */}
      {parshaLine && showExtras && (
        <span
          className="text-muted-foreground flex items-start gap-1 text-[0.6875rem] leading-tight"
          title={parshaLine}
        >
          <BookOpen className="mt-px size-3 shrink-0" />
          <span className="line-clamp-2 min-w-0">{parshaLine}</span>
        </span>
      )}

      {/* Full only: Shabbat Mevarchim. */}
      {mevarchimLabel && showExtras && (
        <span
          className="text-muted-foreground flex items-start gap-1 text-[0.6875rem] leading-tight"
          title={mevarchimLabel}
        >
          <Sparkles className="mt-px size-3 shrink-0" />
          <span className="line-clamp-2 min-w-0">{mevarchimLabel}</span>
        </span>
      )}
      </div>
    </button>
  );
}
