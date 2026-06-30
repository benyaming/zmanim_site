'use client';

import { BookOpen, Flame, Sparkles, Utensils, UtensilsCrossed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import type { DateTime } from 'luxon';

import type { CalendarMode, DayEvent, DayEventType, DayInfo } from '@/lib/calendar';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { categoryChipClass, cellBackgroundClass, DAY_TONE, significantTone } from './day-style';

const EVENT_META: Record<DayEventType, { Icon: LucideIcon; className: string }> = {
  candle: { Icon: Flame, className: 'text-amber-600 dark:text-amber-400' },
  havdalah: { Icon: Sparkles, className: 'text-violet-600 dark:text-violet-400' },
  fastStart: { Icon: UtensilsCrossed, className: 'text-rose-600 dark:text-rose-400' },
  fastEnd: { Icon: Utensils, className: 'text-emerald-600 dark:text-emerald-400' },
};


interface CalendarDayProps {
  date: DateTime;
  inMonth: boolean;
  info: DayInfo;
  chipLabel: string | null;
  events: DayEvent[];
  mode: CalendarMode;
  locale: string;
  /** Force the compact (mobile-style) cell at all widths — used at the largest text size. */
  compact: boolean;
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
  compact,
  isSelected,
  isToday,
  onSelect,
}: CalendarDayProps) {
  const tEvents = useTranslations('events');
  const primary = mode === 'hebrew' ? info.hebrewDayOfMonth : date.day;
  const secondary =
    mode === 'hebrew'
      ? date.setLocale(locale).toLocaleString({ day: 'numeric', month: 'short' })
      : `${info.hebrewDayOfMonth} ${info.hebrewMonth}`;

  // Rosh Chodesh days that aren't otherwise labeled still use the Rosh Chodesh tint.
  const chipCategory = info.category === 'weekday' && info.isRoshChodesh ? 'roshChodesh' : info.category;

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-pressed={isSelected}
      aria-current={isToday ? 'date' : undefined}
      className={cn(
        'flex h-full min-h-11 flex-col gap-0.5 overflow-hidden p-1 text-start transition-colors sm:min-h-12 sm:gap-1 sm:p-1.5',
        'hover:bg-day-selected/15 focus-visible:ring-day-selected focus-visible:ring-2 focus-visible:outline-none',
        cellBackgroundClass(info.category, !inMonth),
        !inMonth && 'text-muted-foreground',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={cn(
            'flex size-6 items-center justify-center rounded-md text-[0.8125rem] font-semibold sm:size-7 sm:text-base',
            isSelected && 'bg-day-selected text-white',
            !isSelected && isToday && 'ring-day-selected text-day-selected ring-2',
          )}
        >
          {primary}
        </span>
        <span
          className={cn('text-muted-foreground text-[0.6875rem] leading-tight', compact ? 'hidden' : 'hidden sm:inline')}
        >
          {secondary}
        </span>
      </div>

      {/* Alternative-calendar date — kept in the compact (mobile / largest-text) cell. */}
      <span className={cn('text-muted-foreground truncate text-[0.625rem] leading-tight', !compact && 'sm:hidden')}>
        {secondary}
      </span>

      {/* Compact (mobile, or largest text size): a single dot marks a significant day. */}
      {chipLabel && (
        <div className={cn('flex', !compact && 'sm:hidden')} aria-hidden>
          <span
            className={cn('size-1.5 shrink-0 rounded-full', DAY_TONE[significantTone(info.category, info.dayOfChanukah)].dot)}
            title={chipLabel}
          />
        </div>
      )}

      {chipLabel && (
        <span
          className={cn(
            'truncate rounded px-1 py-0.5 text-[0.625rem] leading-tight font-medium text-[color:var(--day-label)] sm:text-[0.6875rem]',
            compact ? 'hidden' : 'hidden sm:block',
            categoryChipClass(chipCategory),
          )}
          title={chipLabel}
        >
          {chipLabel}
        </span>
      )}

      {events.length > 0 && (
        <div className={cn('flex-col gap-0.5', compact ? 'hidden' : 'hidden sm:flex')}>
          {events.map((event, i) => {
            const { Icon, className } = EVENT_META[event.type];
            return (
              <span
                key={`${event.type}-${i}`}
                className="flex items-center gap-1 text-[0.625rem] leading-tight font-medium tabular-nums sm:text-[0.6875rem]"
                title={tEvents(event.type)}
              >
                <Icon className={cn('size-3 shrink-0', className)} />
                {formatTime(event.time, locale)}
              </span>
            );
          })}
        </div>
      )}

      {info.parsha && (
        <span
          className={cn(
            'text-muted-foreground items-center gap-1 truncate text-[0.6875rem]',
            compact ? 'hidden' : 'hidden sm:flex',
          )}
          title={info.parsha}
        >
          <BookOpen className="size-3 shrink-0" />
          {info.parsha}
        </span>
      )}
    </button>
  );
}
