'use client';

import { JewishDate } from 'kosher-zmanim';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { DateTime } from 'luxon';
import { useState } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { createHebrewFormatter, jewishToLocalDay, monthAnchor, nextMonth, nextYear, prevMonth, prevYear } from '@/lib/calendar';
import { dirForLocale } from '@/i18n/routing';

import { MonthYearPicker } from './month-year-picker';

function useMonthTitle(): string {
  const { monthDate, mode } = useAppState();
  const locale = useLocale();
  if (mode === 'hebrew') {
    const jd = new JewishDate(monthDate);
    return `${createHebrewFormatter(locale).formatMonth(jd)} ${jd.getJewishYear()}`;
  }
  return monthDate.setLocale(locale).toLocaleString({ month: 'long', year: 'numeric' });
}

/**
 * The viewed month expressed in the *other* calendar system — the Hebrew
 * month(s) a civil month spans, or the civil month(s) a Hebrew month spans.
 * Years are repeated only when the span crosses a year boundary.
 */
function useAlternateMonths(): string {
  const { monthDate, mode } = useAppState();
  const locale = useLocale();

  if (mode === 'hebrew') {
    const jd = new JewishDate(monthDate);
    jd.setJewishDayOfMonth(1);
    // jewishToLocalDay severs kosher-zmanim's bundled Luxon — its DateTimes
    // don't interoperate safely with this app's Luxon instance.
    const start = jewishToLocalDay(jd).setLocale(locale);
    const end = start.plus({ days: jd.getDaysInJewishMonth() - 1 });
    if (start.month === end.month) return start.toLocaleString({ month: 'long', year: 'numeric' });
    const endLabel = end.toLocaleString({ month: 'long', year: 'numeric' });
    if (start.year === end.year) return `${start.toLocaleString({ month: 'long' })} – ${endLabel}`;
    return `${start.toLocaleString({ month: 'long', year: 'numeric' })} – ${endLabel}`;
  }

  const fmt = createHebrewFormatter(locale);
  const start = new JewishDate(monthDate.startOf('month'));
  const end = new JewishDate(monthDate.endOf('month').startOf('day'));
  if (start.getJewishMonth() === end.getJewishMonth()) return `${fmt.formatMonth(start)} ${start.getJewishYear()}`;
  if (start.getJewishYear() === end.getJewishYear()) {
    return `${fmt.formatMonth(start)} – ${fmt.formatMonth(end)} ${end.getJewishYear()}`;
  }
  return `${fmt.formatMonth(start)} ${start.getJewishYear()} – ${fmt.formatMonth(end)} ${end.getJewishYear()}`;
}

export function CalendarView() {
  const { monthDate, mode, setMode, setMonthDate, setSelectedDay } = useAppState();
  const t = useTranslations('calendar');
  const locale = useLocale();
  const title = useMonthTitle();
  const alternateMonths = useAlternateMonths();
  const rtl = dirForLocale(locale) === 'rtl';
  const [pickerOpen, setPickerOpen] = useState(false);

  // In RTL the visual "previous" sits on the right, so swap the chevrons.
  const PrevIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;
  const PrevYearIcon = rtl ? ChevronsRight : ChevronsLeft;
  const NextYearIcon = rtl ? ChevronsLeft : ChevronsRight;

  const goToday = () => {
    const now = DateTime.now();
    setMonthDate(monthAnchor(now, mode));
    setSelectedDay(now.startOf('day'));
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex flex-wrap items-center gap-x-2 gap-y-0 text-xl font-semibold tracking-tight hover:opacity-80 sm:text-2xl"
            >
              <span className="flex items-center gap-1.5 capitalize">
                {title}
                <ChevronDown className="size-4 opacity-50" />
              </span>
              <span className="text-muted-foreground text-sm font-normal tracking-normal">{alternateMonths}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto space-y-2">
            <p className="text-sm font-medium">{t('jumpTo')}</p>
            {/* Keyed so the picker's browsed-year state resets if the mode or
                viewed month changes while it is mounted — a stale Gregorian
                year fed into a Hebrew-mode render would be out of range. */}
            <MonthYearPicker key={`${mode}-${monthDate.toISODate()}`} onPicked={() => setPickerOpen(false)} />
          </PopoverContent>
        </Popover>

        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && setMode(v as 'gregorian' | 'hebrew')}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="gregorian">{t('civil')}</ToggleGroupItem>
            <ToggleGroupItem value="hebrew">{t('hebrew')}</ToggleGroupItem>
          </ToggleGroup>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label={t('prevYear')} onClick={() => setMonthDate(prevYear(monthDate, mode))}>
              <PrevYearIcon className="size-4" />
            </Button>
            <Button variant="outline" size="icon" aria-label={t('prevMonth')} onClick={() => setMonthDate(prevMonth(monthDate, mode))}>
              <PrevIcon className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              {t('today')}
            </Button>
            <Button variant="outline" size="icon" aria-label={t('nextMonth')} onClick={() => setMonthDate(nextMonth(monthDate, mode))}>
              <NextIcon className="size-4" />
            </Button>
            <Button variant="outline" size="icon" aria-label={t('nextYear')} onClick={() => setMonthDate(nextYear(monthDate, mode))}>
              <NextYearIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
