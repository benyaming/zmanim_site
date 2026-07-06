'use client';

import { JewishDate } from 'kosher-zmanim';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { DateTime } from 'luxon';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { daysInJewishMonth, isHebrewLeapYear } from '@/lib/calendar';
import {
  barMitzvahYear,
  type CustomDate,
  type CustomDateKind,
  formatHebrewDateParts,
  type HebrewDateParts,
  hebrewPartsToDay,
  MAX_CUSTOM_DATES,
  nextOccurrence,
  occurrenceInYear,
} from '@/lib/custom-dates';

const KINDS: CustomDateKind[] = ['birthday', 'barMitzvah', 'batMitzvah', 'yahrzeit'];

function partsFromDay(dt: DateTime): HebrewDateParts {
  const jd = new JewishDate(dt);
  return { year: jd.getJewishYear(), month: jd.getJewishMonth(), day: jd.getJewishDayOfMonth() };
}

/** Clamp a date's day/month into a target year (e.g. after changing year or month). */
function clampParts(parts: HebrewDateParts): HebrewDateParts {
  const maxMonth = isHebrewLeapYear(parts.year) ? 13 : 12;
  const month = Math.min(parts.month, maxMonth);
  const day = Math.min(parts.day, daysInJewishMonth(parts.year, month));
  return { year: parts.year, month, day };
}

const kindNameKey = (kind: CustomDateKind): string => `kind${kind[0].toUpperCase()}${kind.slice(1)}`;

type Translator = (key: string, values?: Record<string, string | number>) => string;

interface FormState {
  kind: CustomDateKind;
  label: string;
  hebrew: HebrewDateParts;
  afterSunset: boolean;
  mode: 'gregorian' | 'hebrew';
  /** Explicit Adar choice; undefined = kind default. */
  adarBehavior?: 'adar1' | 'adar2';
}

/** Whether the per-entry Adar choice is meaningful for this anchor + kind. */
function adarChoiceRelevant(state: FormState): boolean {
  return (
    (state.kind === 'birthday' || state.kind === 'yahrzeit') &&
    state.hebrew.month === 12 &&
    !isHebrewLeapYear(state.hebrew.year)
  );
}

function defaultAdar(kind: CustomDateKind): 'adar1' | 'adar2' {
  return kind === 'yahrzeit' ? 'adar1' : 'adar2';
}

/** The shared add/edit form. Its single source of truth is the canonical Hebrew date. */
function CustomDateForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: FormState;
  onSubmit: (entry: Omit<CustomDate, 'id'>) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('customDates');
  const locale = useLocale();
  const [state, setState] = useState<FormState>(initial);
  const { kind, label, hebrew, afterSunset, mode } = state;

  const gregorianDay = hebrewPartsToDay(hebrew).minus({ days: afterSunset ? 1 : 0 });

  const setHebrew = (next: HebrewDateParts) => setState((s) => ({ ...s, hebrew: clampParts(next) }));

  const onGregorianChange = (iso: string) => {
    const dt = DateTime.fromISO(iso);
    if (!dt.isValid) return;
    setHebrew(partsFromDay(dt.plus({ days: afterSunset ? 1 : 0 })));
  };
  // The Hebrew picker's cell IS the Hebrew day — no sunset offset applies.
  const onHebrewChange = (iso: string) => {
    const dt = DateTime.fromISO(iso);
    if (dt.isValid) setHebrew(partsFromDay(dt));
  };
  const onAfterSunsetChange = (next: boolean) => {
    // Keep the displayed civil date fixed; move the canonical Hebrew day instead.
    const civil = hebrewPartsToDay(hebrew).minus({ days: afterSunset ? 1 : 0 });
    setState((s) => ({ ...s, afterSunset: next, hebrew: partsFromDay(civil.plus({ days: next ? 1 : 0 })) }));
  };

  const submit = () => {
    onSubmit({
      kind,
      label: label.trim(),
      hebrew,
      afterSunset: afterSunset ? true : undefined,
      adarBehavior: adarChoiceRelevant(state) ? (state.adarBehavior ?? defaultAdar(kind)) : undefined,
    });
  };

  return (
    <form
      className="bg-muted/40 mt-1.5 space-y-3 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="block">
        <span className="text-muted-foreground mb-1 block text-xs font-medium">{t('nameLabel')}</span>
        <Input
          value={label}
          onChange={(e) => setState((s) => ({ ...s, label: e.target.value }))}
          placeholder={t('namePlaceholder')}
          autoFocus
          maxLength={60}
        />
      </label>

      <label className="block">
        <span className="text-muted-foreground mb-1 block text-xs font-medium">{t('kindLabel')}</span>
        <Select value={kind} onValueChange={(v) => setState((s) => ({ ...s, kind: v as CustomDateKind }))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {t(kindNameKey(k))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && setState((s) => ({ ...s, mode: v as FormState['mode'] }))}
        className="w-full"
      >
        <ToggleGroupItem value="gregorian" className="flex-1">
          {t('modeGregorian')}
        </ToggleGroupItem>
        <ToggleGroupItem value="hebrew" className="flex-1">
          {t('modeHebrew')}
        </ToggleGroupItem>
      </ToggleGroup>

      {mode === 'gregorian' ? (
        <div className="space-y-2">
          <div>
            <span className="text-muted-foreground mb-1 block text-xs font-medium">{t('gregorianDate')}</span>
            <DatePicker
              value={gregorianDay.toISODate() ?? undefined}
              onChange={onGregorianChange}
              placeholder={t('gregorianDate')}
              aria-label={t('gregorianDate')}
            />
          </div>
          <label className="flex items-start gap-2">
            <Checkbox
              checked={afterSunset}
              onCheckedChange={(c) => onAfterSunsetChange(c === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              {t('afterSunset')}
              <span className="text-muted-foreground block text-xs">{t('afterSunsetHint')}</span>
            </span>
          </label>
        </div>
      ) : (
        <div>
          <span className="text-muted-foreground mb-1 block text-xs font-medium">{t('gregorianDate')}</span>
          <DatePicker
            mode="hebrew"
            value={hebrewPartsToDay(hebrew).toISODate() ?? undefined}
            onChange={onHebrewChange}
            placeholder={t('modeHebrew')}
            aria-label={t('modeHebrew')}
          />
        </div>
      )}

      {adarChoiceRelevant(state) && (
        <label className="block">
          <span className="text-muted-foreground mb-1 block text-xs font-medium">{t('adarLabel')}</span>
          <Select
            value={state.adarBehavior ?? defaultAdar(kind)}
            onValueChange={(v) => setState((s) => ({ ...s, adarBehavior: v as 'adar1' | 'adar2' }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adar1">{t('adarI')}</SelectItem>
              <SelectItem value="adar2">{t('adarII')}</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground mt-1 block text-xs">{t('adarHint')}</span>
        </label>
      )}

      <p className="text-muted-foreground text-xs">
        {t('preview', {
          hebrew: formatHebrewDateParts(hebrew, locale),
          gregorian: gregorianDay.setLocale(locale).toLocaleString(DateTime.DATE_MED),
        })}
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" size="sm">
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

/** The "next / was on" line under a list row. */
function occurrenceLine(entry: CustomDate, today: DateTime, locale: string, t: Translator): string | null {
  const fmt = (dt: DateTime) => dt.setLocale(locale).toLocaleString(DateTime.DATE_MED);
  if (entry.kind === 'barMitzvah' || entry.kind === 'batMitzvah') {
    const occ = occurrenceInYear(entry, barMitzvahYear(entry));
    if (!occ) return null;
    const date = hebrewPartsToDay(occ.hebrew);
    return date >= today.startOf('day') ? t('willBe', { date: fmt(date) }) : t('wasOn', { date: fmt(date) });
  }
  const next = nextOccurrence(entry, today);
  return next ? t('next', { date: fmt(next.date) }) : null;
}

/** Manager for personal recurring dates (birthdays, bar/bat mitzvahs, yahrzeits). */
export function CustomDatesTool() {
  const t = useTranslations('customDates');
  const locale = useLocale();
  const { customDates, addCustomDate, updateCustomDate, removeCustomDate } = useAppState();
  const today = DateTime.now();
  // 'new' = the add form; an id = editing that entry.
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  const newFormState = (): FormState => ({
    kind: 'birthday',
    label: '',
    hebrew: partsFromDay(today),
    afterSunset: false,
    mode: 'gregorian',
  });
  const editFormState = (entry: CustomDate): FormState => ({
    kind: entry.kind,
    label: entry.label,
    hebrew: entry.hebrew,
    afterSunset: entry.afterSunset ?? false,
    mode: entry.afterSunset ? 'gregorian' : 'hebrew',
    adarBehavior: entry.adarBehavior,
  });

  const atLimit = customDates.length >= MAX_CUSTOM_DATES;

  return (
    <div className="space-y-2">
      {customDates.length === 0 && editingId !== 'new' && (
        <p className="text-muted-foreground py-4 text-center text-sm">{t('empty')}</p>
      )}

      <ul className="space-y-0.5">
        {customDates.map((entry) => {
          if (editingId === entry.id) {
            return (
              <li key={entry.id}>
                <CustomDateForm
                  initial={editFormState(entry)}
                  onSubmit={(patch) => {
                    updateCustomDate(entry.id, patch);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            );
          }
          const displayLabel = entry.label.trim() || t(kindNameKey(entry.kind));
          const line = occurrenceLine(entry, today, locale, t);
          return (
            <li key={entry.id} className="flex items-center gap-0.5">
              <div className="flex min-w-0 flex-1 flex-col px-2 py-1.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{displayLabel}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {t(kindNameKey(entry.kind))}
                  </Badge>
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {formatHebrewDateParts(entry.hebrew, locale)}
                  {line ? ` · ${line}` : ''}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground size-7 shrink-0"
                aria-label={t('edit')}
                onClick={() => setEditingId(entry.id)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive size-7 shrink-0"
                aria-label={t('delete')}
                onClick={() => removeCustomDate(entry.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>

      {editingId === 'new' ? (
        <CustomDateForm
          initial={newFormState()}
          onSubmit={(entry) => {
            addCustomDate(entry);
            setEditingId(null);
          }}
          onCancel={() => setEditingId(null)}
        />
      ) : (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground w-full justify-start gap-2 px-2"
            onClick={() => setEditingId('new')}
            disabled={atLimit}
          >
            <Plus className="size-4" />
            {t('add')}
          </Button>
          {atLimit && <p className="text-muted-foreground px-2 text-xs">{t('limit', { max: MAX_CUSTOM_DATES })}</p>}
        </div>
      )}
    </div>
  );
}
