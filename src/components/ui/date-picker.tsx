'use client';

import { JewishDate } from 'kosher-zmanim';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { DateTime, Info } from 'luxon';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { dirForLocale } from '@/i18n/routing';
import {
  buildMonthGrid,
  createHebrewFormatter,
  hebrewMonthsOfYear,
  isHebrewLeapYear,
  jewishToLocalDay,
  monthAnchor,
  nextMonth,
  prevMonth,
} from '@/lib/calendar';
import { cn } from '@/lib/utils';

import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

/** Which calendar system the picker navigates and labels its days in. */
export type PickerMode = 'gregorian' | 'hebrew';

/** Sunday-first localized short weekday initials (shared by both systems). */
function weekdayHeaders(locale: string): string[] {
  const names = Info.weekdays('short', { locale }); // Mon…Sun
  return [names[6], ...names.slice(0, 6)];
}

const parseIso = (iso: string | undefined): DateTime | null => {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso);
  return dt.isValid ? dt.startOf('day') : null;
};

/** A JewishDate anchored on the 15th of a Hebrew year/month (for navigation math). */
function hebrewMonthAnchor(year: number, month: number): JewishDate {
  const jd = new JewishDate();
  jd.setJewishDate(year, month, 15);
  return jd;
}

/** The Hebrew year label — gematria in Hebrew script, plain digits otherwise. */
function hebrewYearText(year: number, locale: string, fmt: ReturnType<typeof createHebrewFormatter>): string {
  return locale === 'he' ? fmt.formatHebrewNumber(year) : String(year);
}

/** One rendered day cell: its Gregorian day, the number to show, and month membership. */
interface DayCell {
  date: DateTime;
  label: number;
  inMonth: boolean;
}

interface MiniCalendarProps {
  /** Selected day as an ISO date (yyyy-mm-dd) — the Gregorian day of the anchor. */
  value?: string;
  onChange: (iso: string) => void;
  /** Selectable range bounds, inclusive (ISO dates). */
  min?: string;
  max?: string;
  /** Calendar system to navigate in (default Gregorian). */
  mode?: PickerMode;
  className?: string;
}

/**
 * A self-contained month calendar — a day grid plus month/year jump selects —
 * with no date-picker library. Works in either calendar system: Gregorian, or
 * Hebrew (day cells show the Hebrew day-of-month, navigation steps by Hebrew
 * month, and the selects list that year's Hebrew months incl. Adar I/II).
 * Localized and RTL-aware.
 *
 * Seeds its shown month from `value` on mount; every consumer remounts it on
 * open (Radix unmounts closed popover content), so the shown month always
 * reflects the current value without a syncing effect.
 */
export function MiniCalendar({ value, onChange, min, max, mode = 'gregorian', className }: MiniCalendarProps) {
  const locale = useLocale();
  const t = useTranslations('calendar');
  const rtl = dirForLocale(locale) === 'rtl';
  const today = DateTime.now().startOf('day');
  const selected = parseIso(value);
  const minDate = parseIso(min);
  const maxDate = parseIso(max);
  const hebrew = mode === 'hebrew';

  const seed = selected ?? (maxDate && today > maxDate ? maxDate : today);
  const [view, setView] = useState<DateTime>(hebrew ? monthAnchor(seed, 'hebrew') : seed.startOf('month'));

  const PrevIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;

  let monthSelect: ReactNode;
  let yearSelect: ReactNode;
  let days: DayCell[];
  let goPrev: () => void;
  let goNext: () => void;
  let prevDisabled = false;
  let nextDisabled = false;

  if (hebrew) {
    const fmt = createHebrewFormatter(locale);
    const jdView = new JewishDate(view);
    const hYear = jdView.getJewishYear();
    const hMonth = jdView.getJewishMonth();
    const currentHYear = new JewishDate(today).getJewishYear();
    const maxHYear = maxDate ? new JewishDate(maxDate).getJewishYear() : currentHYear + 10;
    const minHYear = minDate ? new JewishDate(minDate).getJewishYear() : currentHYear - 120;

    const goToHebrew = (year: number, month: number) => setView(jewishToLocalDay(hebrewMonthAnchor(year, month)));

    const yearOptions: number[] = [];
    for (let y = maxHYear; y >= minHYear; y--) yearOptions.push(y);

    monthSelect = (
      <Select value={String(hMonth)} onValueChange={(v) => goToHebrew(hYear, Number(v))}>
        <SelectTrigger size="sm" className="h-8 flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {hebrewMonthsOfYear(hYear).map((m) => (
            <SelectItem key={m} value={String(m)}>
              {fmt.formatMonth(hebrewMonthAnchor(hYear, m))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
    yearSelect = (
      <Select
        value={String(hYear)}
        // Adar II (13) only exists in leap years — clamp to Adar (12) otherwise.
        onValueChange={(v) => goToHebrew(Number(v), hMonth === 13 && !isHebrewLeapYear(Number(v)) ? 12 : hMonth)}
      >
        <SelectTrigger size="sm" className="h-8 w-24 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {hebrewYearText(y, locale, fmt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
    days = buildMonthGrid(view, 'hebrew').cells.map((c) => ({
      date: c.date,
      label: new JewishDate(c.date).getJewishDayOfMonth(),
      inMonth: c.inMonth,
    }));
    goPrev = () => setView(prevMonth(view, 'hebrew'));
    goNext = () => setView(nextMonth(view, 'hebrew'));
  } else {
    const months = Info.months('long', { locale }); // Jan…Dec
    const minYear = minDate?.year ?? today.year - 120;
    const maxYear = maxDate?.year ?? today.year + 10;
    const monthStart = view.startOf('month');

    const setViewClamped = (next: DateTime) => {
      const clamped = next.year < minYear ? next.set({ year: minYear }) : next.year > maxYear ? next.set({ year: maxYear }) : next;
      setView(clamped.startOf('month'));
    };

    const yearOptions: number[] = [];
    for (let y = maxYear; y >= minYear; y--) yearOptions.push(y);

    monthSelect = (
      <Select value={String(view.month)} onValueChange={(v) => setViewClamped(view.set({ month: Number(v) }))}>
        <SelectTrigger size="sm" className="h-8 flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((name, i) => (
            <SelectItem key={i} value={String(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
    yearSelect = (
      <Select value={String(view.year)} onValueChange={(v) => setView(view.set({ year: Number(v) }).startOf('month'))}>
        <SelectTrigger size="sm" className="h-8 w-20 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
    // Sunday-first grid: Luxon weekday is Mon=1…Sun=7, so `weekday % 7` is the
    // Sunday-based offset (Sun→0). Always six weeks for a stable height.
    const gridStart = monthStart.minus({ days: monthStart.weekday % 7 });
    days = Array.from({ length: 42 }, (_, i) => {
      const date = gridStart.plus({ days: i });
      return { date, label: date.day, inMonth: date.month === view.month };
    });
    goPrev = () => setViewClamped(view.minus({ months: 1 }));
    goNext = () => setViewClamped(view.plus({ months: 1 }));
    prevDisabled = minDate ? monthStart <= minDate.startOf('month') : false;
    nextDisabled = maxDate ? monthStart >= maxDate.startOf('month') : false;
  }

  return (
    <div className={cn('w-64 space-y-2', className)}>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label={t('prevMonth')} disabled={prevDisabled} onClick={goPrev}>
          <PrevIcon className="size-4" />
        </Button>
        {monthSelect}
        {yearSelect}
        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label={t('nextMonth')} disabled={nextDisabled} onClick={goNext}>
          <NextIcon className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {weekdayHeaders(locale).map((name, i) => (
          <span key={i} className="text-muted-foreground py-1 text-center text-[0.6875rem] font-medium">
            {name}
          </span>
        ))}
        {days.map(({ date, label, inMonth }) => {
          const isSelected = selected ? date.hasSame(selected, 'day') : false;
          const isToday = date.hasSame(today, 'day');
          const disabled = Boolean((minDate && date < minDate) || (maxDate && date > maxDate));
          return (
            <button
              key={date.toISODate()}
              type="button"
              disabled={disabled}
              onClick={() => onChange(date.toISODate() ?? '')}
              className={cn(
                'flex h-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors',
                'disabled:pointer-events-none disabled:opacity-30',
                !inMonth && 'text-muted-foreground',
                !isSelected && 'hover:bg-accent hover:text-accent-foreground',
                isToday && !isSelected && 'text-day-selected font-semibold',
                isSelected && 'bg-day-selected text-white',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface DatePickerProps extends MiniCalendarProps {
  /** Shown on the trigger when no date is selected. */
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  /** Extra classes for the trigger button. */
  triggerClassName?: string;
}

/** The trigger's label: the Hebrew date in Hebrew mode, otherwise the civil date. */
function triggerLabel(selected: DateTime, locale: string, mode: PickerMode): string {
  if (mode === 'hebrew') return createHebrewFormatter(locale).format(new JewishDate(selected));
  return selected.setLocale(locale).toLocaleString(DateTime.DATE_MED);
}

/**
 * A date field: a button showing the formatted value that opens {@link
 * MiniCalendar} in a popover. Replaces the browser-native `<input type="date">`
 * so the picker looks and behaves the same across the app, in either calendar
 * system.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  mode = 'gregorian',
  placeholder,
  id,
  disabled,
  triggerClassName,
  ...aria
}: DatePickerProps) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const selected = parseIso(value);
  const label = selected ? triggerLabel(selected, locale, mode) : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={aria['aria-label']}
          className={cn('w-full justify-start gap-2 font-normal', !selected && 'text-muted-foreground', triggerClassName)}
        >
          <CalendarDays className="size-4 shrink-0 opacity-70" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <MiniCalendar
          value={value}
          min={min}
          max={max}
          mode={mode}
          onChange={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
