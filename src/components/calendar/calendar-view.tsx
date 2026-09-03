'use client';

import { JewishDate } from 'kosher-zmanim';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { DateTime } from 'luxon';
import { useState } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCalendarNavStage } from '@/hooks/use-calendar-nav-stage';
import { useCoarsePointer } from '@/hooks/use-coarse-pointer';
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
  // How much of the nav fits beside the title, measured; and — when only one
  // arrow pair fits — which pair is worth keeping.
  const { rowRef, stage } = useCalendarNavStage();
  const touch = useCoarsePointer();
  // The month is swipeable on touch, so there the year jumps are the pair that
  // earns the space; driving a narrow window with a mouse (a Telegram mini app
  // on the desktop client, a small browser window) it is the month arrows.
  const showYears = stage < 2 || touch;
  const showMonths = stage < 2 || !touch;

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
      {/* Wrap-aware header. Mobile collapses to two lines: title + compact month
          nav (filling what used to be an empty top-right corner), then the
          calendar-system toggle as a full-width segmented control. ≥sm puts it
          all on one line: title left, toggle + full nav hugging the right. */}
      <div ref={rowRef} className="flex flex-wrap items-start gap-2 sm:gap-3">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-cal="title"
              className="flex flex-col items-start gap-0.5 text-xl font-semibold tracking-tight hover:opacity-80 sm:text-2xl"
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

        {/* order-last + w-full drops this onto its own line under the title on
            mobile; on ≥sm it returns to source order and hugs the right (ms-auto). */}
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && setMode(v as 'gregorian' | 'hebrew')}
          variant="outline"
          size="sm"
          data-cal="toggle"
          className="order-last w-full sm:order-none sm:ms-auto sm:w-fit"
        >
          <ToggleGroupItem value="gregorian" className="flex-1 sm:flex-initial">
            {t('civil')}
          </ToggleGroupItem>
          <ToggleGroupItem value="hebrew" className="flex-1 sm:flex-initial">
            {t('hebrew')}
          </ToggleGroupItem>
        </ToggleGroup>

        {/* ms-auto pins the nav to the title's right until the row is wide
            enough to seat the toggle there too. What the nav shows is decided
            by measurement, not a breakpoint — see useCalendarNavStage. */}
        <div data-cal="nav" className="ms-auto flex items-center gap-1 sm:ms-0">
          {showYears && (
            <Button
              variant="outline"
              size="icon"
              data-cal="arrow"
              aria-label={t('prevYear')}
              onClick={() => setMonthDate(prevYear(monthDate, mode))}
            >
              <PrevYearIcon className="size-4" />
            </Button>
          )}
          {showMonths && (
            <Button
              variant="outline"
              size="icon"
              data-cal="arrow"
              aria-label={t('prevMonth')}
              onClick={() => setMonthDate(prevMonth(monthDate, mode))}
            >
              <PrevIcon className="size-4" />
            </Button>
          )}
          {/* The word costs ~25px (~40 in Russian) in the one row where the nav
              competes with the title, so it is the first thing to go; the label
              stays as the accessible name. */}
          <Button
            variant="outline"
            size={stage === 0 ? 'sm' : 'icon'}
            data-cal="today"
            aria-label={t('today')}
            onClick={goToday}
          >
            {stage === 0 ? t('today') : <CalendarDays className="size-4" />}
          </Button>
          {showMonths && (
            <Button
              variant="outline"
              size="icon"
              data-cal="arrow"
              aria-label={t('nextMonth')}
              onClick={() => setMonthDate(nextMonth(monthDate, mode))}
            >
              <NextIcon className="size-4" />
            </Button>
          )}
          {showYears && (
            <Button
              variant="outline"
              size="icon"
              data-cal="arrow"
              aria-label={t('nextYear')}
              onClick={() => setMonthDate(nextYear(monthDate, mode))}
            >
              <NextYearIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
