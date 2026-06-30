'use client';

import { JewishDate } from 'kosher-zmanim';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { DateTime } from 'luxon';
import { useState } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { createHebrewFormatter, nextMonth, nextYear, prevMonth, prevYear } from '@/lib/calendar';
import { dirForLocale } from '@/i18n/routing';

function useMonthTitle(): string {
  const { monthDate, mode } = useAppState();
  const locale = useLocale();
  if (mode === 'hebrew') {
    const jd = new JewishDate(monthDate);
    return `${createHebrewFormatter(locale).formatMonth(jd)} ${jd.getJewishYear()}`;
  }
  return monthDate.setLocale(locale).toLocaleString({ month: 'long', year: 'numeric' });
}

export function CalendarView() {
  const { monthDate, mode, setMode, setMonthDate, selectedDay, setSelectedDay } = useAppState();
  const t = useTranslations('calendar');
  const locale = useLocale();
  const title = useMonthTitle();
  const rtl = dirForLocale(locale) === 'rtl';
  const [pickerOpen, setPickerOpen] = useState(false);

  // In RTL the visual "previous" sits on the right, so swap the chevrons.
  const PrevIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;
  const PrevYearIcon = rtl ? ChevronsRight : ChevronsLeft;
  const NextYearIcon = rtl ? ChevronsLeft : ChevronsRight;

  const goToday = () => {
    const now = DateTime.now();
    setMonthDate(now.set({ day: 15 }).startOf('day'));
    setSelectedDay(now.startOf('day'));
  };

  const jumpTo = (iso: string) => {
    const d = DateTime.fromISO(iso);
    if (!d.isValid) return;
    setMonthDate(d.set({ day: 15 }).startOf('day'));
    setSelectedDay(d.startOf('day'));
    setPickerOpen(false);
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xl font-semibold tracking-tight capitalize hover:opacity-80 sm:text-2xl"
            >
              {title}
              <ChevronDown className="size-4 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto space-y-2">
            <p className="text-sm font-medium">{t('jumpTo')}</p>
            <Input type="date" value={selectedDay.toISODate() ?? ''} onChange={(e) => jumpTo(e.target.value)} className="w-44" />
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
