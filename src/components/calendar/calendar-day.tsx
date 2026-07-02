'use client';

import { BookOpen, Sparkles, Utensils, UtensilsCrossed, Wheat } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DateTime } from 'luxon';
import type { ComponentType, CSSProperties } from 'react';

import { CandleFlames } from '@/components/icons/candle-flames';
import type { CalendarMode, DayEvent, DayEventType, DayInfo } from '@/lib/calendar';
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

interface CalendarDayProps {
  date: DateTime;
  inMonth: boolean;
  info: DayInfo;
  chipLabel: string | null;
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
  chipLabel,
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

  // Rosh Chodesh days that aren't otherwise labeled still use the Rosh Chodesh tint.
  const chipCategory = info.category === 'weekday' && info.isRoshChodesh ? 'roshChodesh' : info.category;

  const showLabels = density !== 'compact'; // medium + full
  const showExtras = density === 'full'; // omer + parsha

  // Shrink the content to fit a short row instead of clipping it. `zoom` scales
  // the whole subtree (text, icons, gaps) and — unlike `transform` — affects
  // layout, so the cell's `overflow-hidden` respects the smaller size. The width
  // is pre-inflated by 1/scale so the zoomed content still fills the cell.
  const fitStyle: CSSProperties | undefined =
    scale < 1 ? { zoom: scale, width: `${(100 / scale).toFixed(3)}%` } : undefined;

  return (
    <button
      type="button"
      data-day-cell
      onClick={() => onSelect(date)}
      aria-pressed={isSelected}
      aria-current={isToday ? 'date' : undefined}
      className={cn(
        'block h-full min-h-11 overflow-hidden p-1 text-start transition-colors sm:min-h-12',
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
      <div className="flex flex-col gap-0.5" style={fitStyle}>
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

      {/* Compact: a single dot marks a significant day. */}
      {chipLabel && !showLabels && (
        <div className="flex" aria-hidden>
          <span
            className={cn('size-1.5 shrink-0 rounded-full', DAY_TONE[significantTone(info.category, info.dayOfChanukah)].dot)}
            title={chipLabel}
          />
        </div>
      )}

      {/* Medium + full: the significant-day label. */}
      {chipLabel && showLabels && (
        <span
          className={cn(
            'truncate rounded px-1 text-[0.6875rem] leading-tight font-medium text-[color:var(--day-label)]',
            categoryChipClass(chipCategory),
          )}
          title={chipLabel}
        >
          {chipLabel}
        </span>
      )}

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

      {/* Full only: the omer count. */}
      {info.omer > 0 && showExtras && (
        <span
          className="text-muted-foreground flex items-center gap-1 truncate text-[0.6875rem]"
          title={tPanel('omer', { day: info.omer })}
        >
          <Wheat className="size-3 shrink-0" />
          {tPanel('omer', { day: info.omer })}
        </span>
      )}

      {/* Full only: the weekly parsha. */}
      {info.parsha && showExtras && (
        <span className="text-muted-foreground flex items-center gap-1 truncate text-[0.6875rem]" title={info.parsha}>
          <BookOpen className="size-3 shrink-0" />
          {info.parsha}
        </span>
      )}
      </div>
    </button>
  );
}
