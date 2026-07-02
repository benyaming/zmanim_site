'use client';

import { JewishDate } from 'kosher-zmanim';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DateTime, Info as LuxonInfo } from 'luxon';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { Button } from '@/components/ui/button';
import { dirForLocale } from '@/i18n/routing';
import { createHebrewFormatter, hebrewMonthsOfYear, jewishToLocalDay, monthAnchor } from '@/lib/calendar';
import { cn } from '@/lib/utils';

// kosher-zmanim only supports dates from 18 Teves 3761 (1 CE), so 3762 is the
// first Jewish year every month of which can be constructed; Luxon tops out at
// year 9999. The same numeric cap works for both systems.
const MIN_YEAR = { gregorian: 1, hebrew: 3762 } as const;
const MAX_YEAR = 9999;

/**
 * Month + year picker in the active calendar system: a steppable (and directly
 * editable) year with the year's months beneath it — 12, or 13 with Adar I/II
 * in Hebrew leap years. Picking a month moves the viewed month; the selected
 * day is untouched, exactly like the arrow navigation.
 */
export function MonthYearPicker({ onPicked }: { onPicked?: () => void }) {
  const { monthDate, mode, setMonthDate } = useAppState();
  const locale = useLocale();
  const t = useTranslations('calendar');
  const rtl = dirForLocale(locale) === 'rtl';
  const PrevIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;

  const hebrew = mode === 'hebrew';
  const minYear = MIN_YEAR[mode];
  const viewed = hebrew
    ? (() => {
        const jd = new JewishDate(monthDate);
        return { year: jd.getJewishYear(), month: jd.getJewishMonth() };
      })()
    : { year: monthDate.year, month: monthDate.month };

  // The year being browsed (the popover remounts per open, so this starts fresh
  // on the currently viewed month's year).
  const [year, setYear] = useState(viewed.year);
  const [yearText, setYearText] = useState(String(viewed.year));

  const setYearClamped = (y: number) => {
    const clamped = Math.min(MAX_YEAR, Math.max(minYear, y));
    setYear(clamped);
    setYearText(String(clamped));
  };
  const commitYearText = () => {
    const n = Number.parseInt(yearText, 10);
    if (Number.isFinite(n)) setYearClamped(n);
    else setYearText(String(year));
  };

  const months = hebrew
    ? (() => {
        const fmt = createHebrewFormatter(locale);
        return hebrewMonthsOfYear(year).map((month) => {
          const jd = new JewishDate();
          jd.setJewishDate(year, month, 15);
          return { month, label: fmt.formatMonth(jd) };
        });
      })()
    : LuxonInfo.months('long', { locale }).map((label, i) => ({ month: i + 1, label }));

  const pick = (month: number) => {
    if (hebrew) {
      const jd = new JewishDate();
      jd.setJewishDate(year, month, 15);
      setMonthDate(jewishToLocalDay(jd));
    } else {
      setMonthDate(monthAnchor(DateTime.fromObject({ year, month, day: 15 }), 'gregorian'));
    }
    onPicked?.();
  };

  return (
    <div className="w-64 space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <Button type="button" variant="ghost" size="icon" aria-label={t('prevYear')} onClick={() => setYearClamped(year - 1)}>
          <PrevIcon className="size-4" />
        </Button>
        <input
          inputMode="numeric"
          aria-label={t('year')}
          className="focus-visible:ring-ring w-20 rounded-md bg-transparent text-center text-sm font-semibold tabular-nums focus-visible:ring-2 focus-visible:outline-none"
          value={yearText}
          onChange={(e) => setYearText(e.target.value)}
          onBlur={commitYearText}
          onKeyDown={(e) => e.key === 'Enter' && commitYearText()}
        />
        <Button type="button" variant="ghost" size="icon" aria-label={t('nextYear')} onClick={() => setYearClamped(year + 1)}>
          <NextIcon className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {months.map(({ month, label }) => (
          <Button
            key={month}
            type="button"
            size="sm"
            variant={year === viewed.year && month === viewed.month ? 'default' : 'ghost'}
            className={cn('h-8 min-w-0 px-1 text-xs font-normal', !hebrew && 'capitalize')}
            onClick={() => pick(month)}
          >
            <span className="truncate">{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
