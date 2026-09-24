'use client';

import { CalendarPlus, ChevronDown } from 'lucide-react';
import { DateTime } from 'luxon';
import { useLocale, useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ZMAN_PICKER_SECTIONS, ZmanBaseControl } from '@/components/zmanim/zman-picker';
import { downloadBlob, tableDayCount } from '@/lib/export';
import {
  buildCalendarEvents,
  type CalendarEvent,
  type CalendarExport,
  type CalendarExportOptions,
} from '@/lib/export/calendar-events';
import { icsBlob, MAX_EVENTS_PER_PART, splitIcsParts } from '@/lib/export/ics';
import {
  DEFAULT_ICS_CATEGORIES,
  ICS_ALL_DAY_ALERTS,
  ICS_CATEGORIES,
  ICS_DAILY_ZMAN_KEYS,
  ICS_TIMED_ALERTS,
  type IcsAlerts,
  type IcsAllDayAlert,
  type IcsCategory,
  type IcsTimedAlert,
  MAX_ICS_DAILY_ZMANIM,
  MAX_ICS_DAYS,
  NO_ICS_ALERTS,
  sanitizeIcsZmanKeys,
} from '@/lib/export/ics-preset';
import { fitRangeEnd, rangeLatestEnd } from '@/lib/export/range';
import { formatTime } from '@/lib/format';
import { OBSERVANCE_KINDS, type ObservanceKind } from '@/lib/personal-dates';
import { cn } from '@/lib/utils';

import { reportTranslator } from './export-i18n';
import { EXPORT_FIELD_LABEL, useExportComputeOptions, useExportLocation, useReportLocale } from './export-shared';
import { observanceChipText } from './personal-dates-labels';

/** The bot relays files up to this size (zmanim_bot's MAX_EXPORT_BYTES). */
const MAX_RELAY_BYTES = 30 * 1024 * 1024;

/** How many events the preview lists before "…and N more". */
const PREVIEW_ROWS = 5;

/**
 * The last built export, by a key of every input that changes the file. This
 * build does not run the React Compiler, so nothing else would spare a render
 * — opening an opinion group, or useDeferredValue's urgent pass — from
 * rebuilding a year of events. One entry is enough: the tool shows one
 * preview at a time.
 */
let lastBuild: { key: string; result: CalendarExport } | null = null;

function buildFor(key: string, build: () => CalendarExport): CalendarExport {
  if (lastBuild?.key !== key) lastBuild = { key, result: build() };
  return lastBuild.result;
}

function builtFor(key: string): CalendarExport | null {
  return lastBuild?.key === key ? lastBuild.result : null;
}

/** The daily-zman picker: the shared sections, minus the shaah-zmanis durations. */
const DAILY_KEY_SET = new Set(ICS_DAILY_ZMAN_KEYS);
const DAILY_SECTIONS = ZMAN_PICKER_SECTIONS.map((section) => ({
  ...section,
  bases: section.bases
    .map((b) => ({ ...b, keys: b.keys.filter((k) => DAILY_KEY_SET.has(k)) }))
    .filter((b) => b.keys.length > 0),
})).filter((section) => section.bases.length > 0);

/**
 * The panel's personal-date groups. The three that exist on both calendars get
 * a Hebrew / civil choice each, so civil birthdays and Hebrew yahrzeits can be
 * exported together; the inherently Hebrew milestones are one checkbox.
 */
const PERSONAL_GROUPS: { labelKey: string; kinds: { hebrew: ObservanceKind; civil: ObservanceKind } | ObservanceKind }[] = [
  { labelKey: 'kindBirthday', kinds: { hebrew: 'hebrewBirthday', civil: 'civilBirthday' } },
  { labelKey: 'kindBris', kinds: 'bris' },
  { labelKey: 'kindBarMitzvah', kinds: 'barMitzvah' },
  { labelKey: 'kindBatMitzvah', kinds: 'batMitzvah' },
  { labelKey: 'kindYahrzeit', kinds: { hebrew: 'yahrzeit', civil: 'civilDeathAnniversary' } },
  { labelKey: 'kindShiva', kinds: 'shiva' },
  { labelKey: 'kindShloshim', kinds: 'shloshim' },
  { labelKey: 'kindAnniversary', kinds: { hebrew: 'hebrewAnniversary', civil: 'civilAnniversary' } },
];

const CATEGORY_LABEL: Record<IcsCategory, string> = {
  candles: 'includeCandles',
  fasts: 'includeFasts',
  holidays: 'icsHolidays',
  parsha: 'includeParsha',
};

/**
 * Calendar export: an .ics file of candle lighting, havdala, fasts, holidays,
 * parsha, chosen daily zmanim and personal dates, for import into Google,
 * Apple or Outlook. Built entirely in the browser — the file is a one-time
 * snapshot, not a subscription.
 */
export function ExportIcsTool() {
  const t = useTranslations('export');
  const tName = useTranslations('zmanim.names');
  const tShita = useTranslations('zmanim.shitot');
  const tGroup = useTranslations('zmanim.groups');
  const tPd = useTranslations('personalDates');
  const uiLocale = useLocale();
  const { candleLightingOffset, havdalahOpinion, hiddenFastEnd, personalDates, icsExportPreset, setIcsExportPreset } =
    useAppState();
  // Seeds only, read on the first render: the tools dialog mounts this tool
  // when it is opened, long after the prefs have hydrated.
  const preset = icsExportPreset;
  const { location, locationId, field: locationField } = useExportLocation(preset?.locationId);
  const { reportLocale, field: languageField } = useReportLocale(preset?.reportLocale);
  // Rounding and elevation start from the app settings on every open and are
  // never remembered: the app setting stays their single source.
  const { useElevation, lehumra, field: computeField } = useExportComputeOptions(location);

  // Home range: the 1st of the current month (at the place) for twelve calendar
  // months — or the remembered length, re-anchored on that same 1st.
  const [startIso, setStartIso] = useState(() => {
    const now = DateTime.now().setZone(location.timeZoneId);
    return DateTime.fromObject({ year: now.year, month: now.month, day: 1 }).toISODate() ?? '';
  });
  const [endIso, setEndIso] = useState(() => {
    const first = DateTime.fromISO(startIso);
    const end = preset?.rangeDays
      ? first.plus({ days: preset.rangeDays - 1 })
      : first.plus({ months: 12 }).minus({ days: 1 });
    return end.toISODate() ?? '';
  });
  const [categories, setCategories] = useState<Record<IcsCategory, boolean>>(() => ({
    ...DEFAULT_ICS_CATEGORIES,
    ...preset?.categories,
  }));
  const [zmanKeys, setZmanKeys] = useState<Set<string>>(() => new Set(preset?.zmanKeys ?? []));
  const [openBases, setOpenBases] = useState<Set<string>>(new Set());
  // Whether there is anything to include: a person with no dated event yet
  // contributes nothing, so the switch waits for real dates.
  const hasDates = personalDates.occasions.length > 0 || personalDates.people.some((p) => p.events.length > 0);
  const [includePersonal, setIncludePersonal] = useState(preset?.personal ?? true);
  const [kinds, setKinds] = useState<Set<ObservanceKind>>(() => new Set(preset?.personalKinds ?? OBSERVANCE_KINDS));
  const [alerts, setAlerts] = useState<IcsAlerts>(() => preset?.alerts ?? NO_ICS_ALERTS);
  const [showParts, setShowParts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setKind = (kind: ObservanceKind, on: boolean) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (on) next.add(kind);
      else next.delete(kind);
      return next;
    });

  const setZmanSelected = (key: string, selected: boolean) => {
    setError(null);
    setZmanKeys((prev) => {
      // The cap holds even when a base's "select all" asks for more.
      if (selected && !prev.has(key) && prev.size >= MAX_ICS_DAILY_ZMANIM) return prev;
      const next = new Set(prev);
      if (selected) next.add(key);
      else next.delete(key);
      return next;
    });
  };
  const toggleBase = (base: string) =>
    setOpenBases((prev) => {
      const next = new Set(prev);
      if (next.has(base)) next.delete(base);
      else next.add(base);
      return next;
    });

  const start = DateTime.fromISO(startIso);
  const end = DateTime.fromISO(endIso);
  const rangeDays = start.isValid && end.isValid ? tableDayCount(start, end) : 0;
  const rangeError =
    rangeDays === 0 ? t('invalidRange') : rangeDays > MAX_ICS_DAYS ? t('tooManyDays', { max: MAX_ICS_DAYS }) : null;

  // File content follows the chosen report language; the dialog stays in the UI language.
  const tr = reportTranslator(reportLocale);
  const placeLabel = location.customLabel || location.label;
  const personalKinds = includePersonal && hasDates ? OBSERVANCE_KINDS.filter((k) => kinds.has(k)) : [];
  const options: CalendarExportOptions | null = rangeError
    ? null
    : {
        startIso,
        days: rangeDays,
        location,
        placeLabel,
        categories,
        zmanKeys: sanitizeIcsZmanKeys([...zmanKeys]),
        personalKinds,
        personalDates,
        candleLightingOffset,
        havdalahOpinion,
        hiddenFastEnd,
        useElevation,
        lehumra,
        locale: reportLocale,
        tr,
        personalTitle: (obs) => observanceChipText(obs, (key, values) => tr(`personalDates.${key}`, values)),
      };
  // Everything the file depends on, as one string: equal keys, equal files.
  const buildKey = options
    ? JSON.stringify([
        startIso,
        rangeDays,
        location.lat,
        location.lng,
        location.timeZoneId,
        location.inIsrael,
        location.elevation ?? null,
        placeLabel,
        categories,
        options.zmanKeys,
        personalKinds,
        // The whole data, not personalDatesFingerprint: that one leaves out
        // event ids, which the personal UIDs carry.
        personalKinds.length > 0 ? personalDates : null,
        candleLightingOffset,
        havdalahOpinion,
        hiddenFastEnd,
        useElevation,
        lehumra,
        reportLocale,
      ])
    : null;
  // A year of events takes a moment to build. The deferred key lets a tick
  // render at once with the previous preview (a cache hit), and the new one
  // is built in the background render that follows.
  const deferredKey = useDeferredValue(buildKey);
  const stale = deferredKey !== buildKey;
  const preview: CalendarExport | null =
    deferredKey === null
      ? null
      : stale
        ? builtFor(deferredKey)
        : buildFor(deferredKey, () => buildCalendarEvents(options!));

  // A file over the phone-import limit is also offered in parts (see
  // MAX_EVENTS_PER_PART). Labels come from the preview; the download itself
  // re-splits the CURRENT build, so a part is never taken from a stale one.
  const parts = preview ? splitIcsParts(preview.events) : [];
  // Exact dates: parts usually meet mid-month, and month names alone would
  // make two parts look like they overlap.
  const partLabel = (events: readonly CalendarEvent[]) => {
    const day = (iso: string) => DateTime.fromISO(iso).setLocale(uiLocale).toLocaleString(DateTime.DATE_MED);
    const [from, to] = [day(events[0].date), day(events.at(-1)!.date)];
    return from === to ? from : `${from} – ${to}`;
  };

  /** Download the whole file, or (with `part`) one part of it, 0-based. */
  const download = async (part?: number) => {
    setError(null);
    if (!options || !buildKey) {
      setError(rangeError);
      return;
    }
    setBusy(true);
    try {
      // Always the CURRENT selection — never a preview still catching up.
      const built = buildFor(buildKey, () => buildCalendarEvents(options));
      if (built.events.length === 0) {
        setError(t('icsNothing'));
        return;
      }
      const split = part === undefined ? null : splitIcsParts(built.events);
      const events = split ? split[part!] : built.events;
      if (!events) return;
      const blob = icsBlob({
        name: tr('export.icsCalendarName', { place: placeLabel }),
        events,
        stamp: DateTime.utc(),
        alerts,
      });
      if (blob.size > MAX_RELAY_BYTES) {
        setError(t('icsTooLarge', { mb: (blob.size / 1024 / 1024).toFixed(1) }));
        return;
      }
      const suffix = split ? `-part${part! + 1}-of-${split.length}` : '';
      await downloadBlob(blob, `zmanim-calendar-${startIso.slice(0, 7)}${suffix}.ics`);
      // Remembered once a file exists, never per checkbox — one prefs (and
      // sync) write per export. With no dates the personal switch was never
      // shown, so an earlier explicit choice is carried over untouched.
      setIcsExportPreset({
        rangeDays,
        categories,
        zmanKeys: sanitizeIcsZmanKeys([...zmanKeys]),
        ...(hasDates ? { personal: includePersonal } : preset?.personal !== undefined ? { personal: preset.personal } : {}),
        personalKinds: OBSERVANCE_KINDS.filter((k) => kinds.has(k)),
        locationId,
        reportLocale,
        alerts,
      });
    } catch {
      setError(t('failed'));
    } finally {
      setBusy(false);
    }
  };

  const previewDate = (iso: string) =>
    DateTime.fromISO(iso).setLocale(reportLocale).toLocaleString({ weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <label htmlFor="export-ics-start" className={EXPORT_FIELD_LABEL}>
            {t('from')}
          </label>
          <DatePicker
            id="export-ics-start"
            value={startIso}
            onChange={(iso) => {
              setError(null);
              setStartIso(iso);
              setEndIso(fitRangeEnd(iso, endIso, rangeDays, MAX_ICS_DAYS));
            }}
            aria-label={t('from')}
          />
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <label htmlFor="export-ics-end" className={EXPORT_FIELD_LABEL}>
            {t('to')}
          </label>
          {/* Only days from the start to the cap are selectable, so the range
              can't be reversed or too long. */}
          <DatePicker
            id="export-ics-end"
            value={endIso}
            onChange={(iso) => {
              setError(null);
              setEndIso(iso);
            }}
            min={startIso}
            max={rangeLatestEnd(startIso, MAX_ICS_DAYS)}
            aria-label={t('to')}
          />
        </div>
        {locationField}
        {languageField}
      </div>

      <div className="space-y-1.5">
        {computeField}
        {!lehumra && <p className="text-muted-foreground text-xs">{t('icsSecondsHint')}</p>}
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">{t('icsEvents')}</span>
        {ICS_CATEGORIES.map((category) => (
          <label key={category} htmlFor={`export-ics-${category}`} className="flex cursor-pointer items-center gap-2">
            <Checkbox
              id={`export-ics-${category}`}
              checked={categories[category]}
              onCheckedChange={(v) => setCategories((prev) => ({ ...prev, [category]: v === true }))}
            />
            <span className="text-sm">{t(CATEGORY_LABEL[category])}</span>
          </label>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">{t('icsDailyZmanim')}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {zmanKeys.size}/{MAX_ICS_DAILY_ZMANIM}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">{t('icsDailyHint', { max: MAX_ICS_DAILY_ZMANIM })}</p>
        <div className="space-y-3 rounded-lg border p-3">
          {DAILY_SECTIONS.map((section) => (
            <section key={section.category} className="space-y-1.5">
              <h4 className="text-muted-foreground/70 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">
                {tGroup(section.category)}
              </h4>
              {section.bases.map(({ base, keys }) => (
                <ZmanBaseControl
                  key={base}
                  base={base}
                  name={tName(keys[0])}
                  keys={keys}
                  shitaLabel={tShita}
                  isSelected={(k) => zmanKeys.has(k)}
                  setSelected={setZmanSelected}
                  open={openBases.has(base)}
                  onToggleOpen={() => toggleBase(base)}
                  idPrefix="export-ics-zman"
                  capReached={zmanKeys.size >= MAX_ICS_DAILY_ZMANIM}
                />
              ))}
            </section>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {hasDates ? (
          <>
            <label htmlFor="export-ics-personal" className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id="export-ics-personal"
                checked={includePersonal}
                onCheckedChange={(v) => setIncludePersonal(v === true)}
              />
              <span className="text-sm font-medium">{t('icsPersonal')}</span>
            </label>
            <p className="text-muted-foreground text-xs">{t('icsPersonalHint')}</p>
            {includePersonal && (
              <div className="ms-6 space-y-1.5">
                {PERSONAL_GROUPS.map(({ labelKey, kinds: group }) =>
                  typeof group === 'string' ? (
                    <label key={labelKey} htmlFor={`export-ics-kind-${group}`} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        id={`export-ics-kind-${group}`}
                        checked={kinds.has(group)}
                        onCheckedChange={(v) => setKind(group, v === true)}
                      />
                      <span className="text-sm">{tPd(labelKey)}</span>
                    </label>
                  ) : (
                    <div key={labelKey} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-sm">{tPd(labelKey)}</span>
                      {(['hebrew', 'civil'] as const).map((calendar) => (
                        <label
                          key={calendar}
                          htmlFor={`export-ics-kind-${group[calendar]}`}
                          className="flex cursor-pointer items-center gap-1.5"
                        >
                          <Checkbox
                            id={`export-ics-kind-${group[calendar]}`}
                            checked={kinds.has(group[calendar])}
                            onCheckedChange={(v) => setKind(group[calendar], v === true)}
                          />
                          <span className="text-muted-foreground text-xs">
                            {t(calendar === 'hebrew' ? 'icsHebrew' : 'icsCivil')}
                          </span>
                        </label>
                      ))}
                    </div>
                  ),
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <span className="text-sm font-medium">{t('personalDatesName')}</span>
            <p className="text-muted-foreground text-xs">{t('icsPersonalNone')}</p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">{t('icsAlerts')}</span>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <span className={EXPORT_FIELD_LABEL}>{t('icsAlertTimed')}</span>
          <Select
            value={alerts.timed === null ? 'none' : String(alerts.timed)}
            onValueChange={(v) =>
              setAlerts((prev) => ({ ...prev, timed: v === 'none' ? null : (Number(v) as IcsTimedAlert) }))
            }
          >
            <SelectTrigger className="w-full" aria-label={t('icsAlertTimed')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('icsAlertNone')}</SelectItem>
              {ICS_TIMED_ALERTS.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {minutes === 0 ? t('icsAlertAtTime') : t('icsAlertMinutes', { minutes })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <span className={EXPORT_FIELD_LABEL}>{t('icsAlertAllDay')}</span>
          <Select
            value={alerts.allDay ?? 'none'}
            onValueChange={(v) => setAlerts((prev) => ({ ...prev, allDay: v === 'none' ? null : (v as IcsAllDayAlert) }))}
          >
            <SelectTrigger className="w-full" aria-label={t('icsAlertAllDay')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('icsAlertNone')}</SelectItem>
              {(Object.keys(ICS_ALL_DAY_ALERTS) as IcsAllDayAlert[]).map((key) => {
                const offset = ICS_ALL_DAY_ALERTS[key];
                const at = DateTime.fromObject({ hour: ((offset / 60) % 24 + 24) % 24 })
                  .setLocale(uiLocale)
                  .toLocaleString(DateTime.TIME_SIMPLE);
                return (
                  <SelectItem key={key} value={key}>
                    {offset < 0 ? t('icsAlertDayBefore', { time: at }) : t('icsAlertDayOf', { time: at })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-xs">{t('icsAlertHint')}</p>
      </div>

      <div className={`space-y-1.5 rounded-lg border p-3 transition-opacity ${stale ? 'opacity-60' : ''}`} aria-live="polite">
        {preview ? (
          <>
            <p className="text-sm font-medium">{t('icsCount', { count: preview.events.length })}</p>
            {preview.unavailable > 0 && (
              <p className="text-muted-foreground text-xs">{t('icsUnavailable', { count: preview.unavailable })}</p>
            )}
            <ul className="space-y-0.5">
              {preview.events.slice(0, PREVIEW_ROWS).map((e) => (
                <li key={e.uid} className="flex gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {previewDate(e.date)}
                    {!e.allDay && ` ${formatTime(e.start.setZone(location.timeZoneId), reportLocale)}`}
                  </span>
                  <span className="min-w-0 truncate">{e.title}</span>
                </li>
              ))}
            </ul>
            {preview.events.length > PREVIEW_ROWS && (
              <p className="text-muted-foreground text-xs">{t('icsMore', { count: preview.events.length - PREVIEW_ROWS })}</p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-xs">{rangeError}</p>
        )}
      </div>

      {/* What a downloaded file is — and is not — said before the download. */}
      <div className="bg-muted/50 space-y-1.5 rounded-lg p-3">
        <p className="text-xs font-medium">{t('icsNotesTitle')}</p>
        <ul className="text-muted-foreground list-disc space-y-1 ps-4 text-xs">
          <li>{t('icsNoteSnapshot')}</li>
          <li>{t('icsNotePlace', { place: placeLabel })}</li>
          <li>{t('icsNoteImport')}</li>
          <li>{t('icsNoteDayLabels')}</li>
        </ul>
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}
      <Button onClick={() => download()} disabled={busy || !options} className="w-full" variant="outline">
        <CalendarPlus className="size-4" />
        {busy ? t('generating') : t('icsDownload')}
      </Button>
      {parts.length > 1 && (
        // Over the phone-import limit: the parts wait behind a disclosure, one
        // button each (phones often block several downloads at once).
        <div className="space-y-2">
          <button
            type="button"
            aria-expanded={showParts}
            aria-controls="export-ics-parts"
            onClick={() => setShowParts((open) => !open)}
            className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 text-start text-xs"
          >
            <span>{t('icsPartsToggle', { parts: parts.length })}</span>
            <ChevronDown
              aria-hidden
              className={cn('size-4 shrink-0 transition-transform', !showParts && '-rotate-90 rtl:rotate-90')}
            />
          </button>
          {showParts && (
            <div id="export-ics-parts" className="space-y-2">
              <p className="text-muted-foreground text-xs">
                {t('icsPartsNote', { max: MAX_EVENTS_PER_PART, count: preview!.events.length })}
              </p>
              {parts.map((events, i) => (
                <Button
                  key={`${i}-${events[0].date}`}
                  onClick={() => download(i)}
                  disabled={busy || !options || stale}
                  className="h-auto min-h-8 w-full py-1.5 whitespace-normal"
                  size="sm"
                  variant="outline"
                >
                  {t('icsPart', { n: i + 1, total: parts.length, range: partLabel(events), count: events.length })}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
