'use client';

import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { DateTime } from 'luxon';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { ZMAN_PICKER_SECTIONS, ZmanBaseControl } from '@/components/zmanim/zman-picker';
import { dirForLocale } from '@/i18n/routing';
import { FAST_END_OPINIONS, fastEndZmanKey } from '@/lib/calendar';
import {
  buildExportGrid,
  buildZmanimTable,
  DEFAULT_EXPORT_RANGE_DAYS,
  type ExportColumn,
  type ExportHeader,
  exportTableToCsv,
  exportTableToExcel,
  hebrewMonthSpan,
  MAX_TABLE_DAYS,
  pagesToPdf,
  tableDayCount,
  transposeExportGrid,
} from '@/lib/export';
import { LEARNING_CYCLE_KEYS, type LearningCycleKey } from '@/lib/learning';
import { SITE_HOST } from '@/lib/site';
import { CONFIGURABLE_ZMANIM, zmanLabels, zmanNameShortForKey, ZMANIM } from '@/lib/zmanim';

import { reportTranslator } from './export-i18n';
import { buildZmanimPdfPages, type PdfDocConfig } from './export-pdf-doc';
import { ExportPdfPreview } from './export-preview';
import { renderExportPages } from './export-render';
import { EXPORT_FIELD_LABEL, useExportComputeOptions, useExportLocation, useReportLocale } from './export-shared';

/** Bases with several shitot get "name · shita" labels; single-opinion ones just the name. */
const BASE_KEY_COUNT = new Map<string, number>();
for (const z of ZMANIM) BASE_KEY_COUNT.set(z.base, (BASE_KEY_COUNT.get(z.base) ?? 0) + 1);

/** Export tool: a zmanim table over a date range, as a PDF, an Excel file or CSV. */
export function ExportZmanimTool() {
  const t = useTranslations('export');
  const tName = useTranslations('zmanim.names');
  const tShita = useTranslations('zmanim.shitot');
  const tGroup = useTranslations('zmanim.groups');
  const tPanel = useTranslations('panel');
  const tLearning = useTranslations('learning');
  const {
    candleLightingOffset,
    havdalahOpinion,
    hiddenZmanim,
    hiddenLearning,
    hiddenFastEnd,
    exportPreset,
    setExportPreset,
  } = useAppState();
  // The seed for every control below, and only a seed: each `useState` reads it
  // on the first render and never again, so later edits to the controls are not
  // fighting the saved preset. Safe to take straight from app state because the
  // tools dialog mounts this component only when the tool is opened — long after
  // the prefs have hydrated — so the preset is already present on that first render.
  const preset = exportPreset;
  const { location, locationId, field: locationField } = useExportLocation(preset?.locationId);
  const { reportLocale, field: languageField } = useReportLocale(preset?.reportLocale);
  const { useElevation, lehumra, field: computeField } = useExportComputeOptions(location, preset ?? undefined);

  // Report content follows the chosen report language; the dialog (incl. the
  // zmanim picker) stays in the UI language.
  const tr = reportTranslator(reportLocale);
  const labels = zmanLabels(tr);
  const reportDir = dirForLocale(reportLocale) === 'rtl' ? 'rtl' : 'ltr';

  // Flat "name · shita" headers for the data exports. The PDF builds its own
  // two-tier headers (export-pdf-doc.tsx); CSV and Excel keep every label
  // spelled out in one cell, where width costs nothing.
  const zmanHeader = (key: string): ExportHeader => {
    const def = ZMANIM.find((z) => z.key === key);
    const label = zmanNameShortForKey(labels, key);
    const multi = def ? (BASE_KEY_COUNT.get(def.base) ?? 1) > 1 : false;
    return multi ? { label, sub: labels.shita(key), group: def?.base } : { label };
  };

  const today = DateTime.now().startOf('day');
  // The tool's home range is the CURRENT MONTH, first day to last — whole
  // sheets, never "today + N". A remembered range re-anchors its LENGTH here
  // too, read in months: someone who printed three months in January wants
  // February–April now, not a mid-month stub. Hebrew-months presets count the
  // same length in Hebrew months from this Rosh Chodesh.
  const presetHebrewMonths = preset?.hebrewMonths ?? false;
  const seedMonths = Math.max(1, Math.round((preset?.rangeDays ?? DEFAULT_EXPORT_RANGE_DAYS) / 29.5));
  const seedRange = () => {
    if (presetHebrewMonths) {
      let span = hebrewMonthSpan(today);
      const start = span.start;
      for (let i = 1; i < seedMonths; i++) span = hebrewMonthSpan(span.end.plus({ days: 1 }));
      return { start, end: span.end };
    }
    const start = today.startOf('month');
    return { start, end: start.plus({ months: seedMonths - 1 }).endOf('month') };
  };
  const [startIso, setStartIso] = useState(() => seedRange().start.toISODate() ?? '');
  const [endIso, setEndIso] = useState(() => seedRange().end.toISODate() ?? '');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(preset?.keys ?? CONFIGURABLE_ZMANIM.filter((z) => !hiddenZmanim.includes(z.key)).map((z) => z.key)),
  );
  // Which multi-shita bases are expanded in the picker (all collapsed by default).
  const [openBases, setOpenBases] = useState<Set<string>>(new Set());
  const toggleBase = (base: string) =>
    setOpenBases((prev) => {
      const next = new Set(prev);
      if (next.has(base)) next.delete(base);
      else next.add(base);
      return next;
    });
  // The leading identity columns — each individually removable.
  const columns = preset?.columns;
  const [includeDate, setIncludeDate] = useState(columns?.date ?? true);
  const [includeWeekday, setIncludeWeekday] = useState(columns?.weekday ?? true);
  const [includeHebrewDate, setIncludeHebrewDate] = useState(columns?.hebrewDate ?? true);
  const [includeHoliday, setIncludeHoliday] = useState(columns?.holiday ?? true);
  // The combined day columns: parsha (+ special Shabbat name), candle
  // lighting + havdalah, and the fast bookends.
  const [includeParsha, setIncludeParsha] = useState(columns?.parsha ?? true);
  const [includeCandles, setIncludeCandles] = useState(columns?.candles ?? true);
  const [includeFasts, setIncludeFasts] = useState(columns?.fasts ?? true);
  // Which fast-end opinions the footer answers with — every catalog opinion is
  // offered here; the app's calendar settings only seed the first selection.
  const [selectedFastEnds, setSelectedFastEnds] = useState<Set<string>>(
    () => new Set(preset?.fastEnds ?? FAST_END_OPINIONS.filter((o) => !hiddenFastEnd.includes(o.key)).map((o) => o.key)),
  );
  const [includeMevarchim, setIncludeMevarchim] = useState(columns?.mevarchim ?? true);
  const [includeOmer, setIncludeOmer] = useState(columns?.omer ?? true);
  // Weekly sheets: one calendar week per page, days across the top.
  const [transpose, setTranspose] = useState(preset?.transpose ?? false);
  // Page by Hebrew month — a sheet per Elul — like the calendar's Hebrew mode.
  const [hebrewMonths, setHebrewMonths] = useState(presetHebrewMonths);
  // Daf Yomi only by default; the full set is one tick away. Learning gets its
  // own sheet per month in the PDF, and columns in the data exports.
  const [selectedLearning, setSelectedLearning] = useState<Set<LearningCycleKey>>(
    () => new Set(preset?.learning ?? (['dafYomi'] as LearningCycleKey[]).filter((k) => !hiddenLearning.includes(k))),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setKeySelected = (key: string, selected: boolean) => {
    setError(null);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (selected) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const setLearningSelected = (key: LearningCycleKey, selected: boolean) => {
    setSelectedLearning((prev) => {
      const next = new Set(prev);
      if (selected) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const learningKeys = LEARNING_CYCLE_KEYS.filter((k) => selectedLearning.has(k));
  const start = DateTime.fromISO(startIso);
  const end = DateTime.fromISO(endIso);
  const rangeDays = start.isValid && end.isValid ? tableDayCount(start, end) : 0;
  const anyColumn =
    includeDate ||
    includeWeekday ||
    includeHebrewDate ||
    includeHoliday ||
    includeParsha ||
    includeCandles ||
    includeFasts ||
    includeMevarchim ||
    includeOmer;
  const hasContent = anyColumn || selectedKeys.size > 0 || learningKeys.length > 0;

  // The one config object the PDF is built from — shared by the preview and
  // the download, so the preview is the export. Null while the dialog's inputs
  // can't produce a document.
  const pdfConfig: PdfDocConfig | null =
    rangeDays > 0 && rangeDays <= MAX_TABLE_DAYS && hasContent
      ? {
          startIso,
          endIso,
          keys: [...selectedKeys],
          learningKeys,
          columns: {
            date: includeDate,
            weekday: includeWeekday,
            hebrewDate: includeHebrewDate,
            holiday: includeHoliday,
            parsha: includeParsha,
            candles: includeCandles,
            fasts: includeFasts,
            mevarchim: includeMevarchim,
            omer: includeOmer,
          },
          weekly: transpose,
          hebrewMonths,
          location,
          locationLabel: location.customLabel || location.label,
          candleLightingOffset,
          havdalahOpinion,
          // The dialog's own opinion picker, expressed as the hide-list the
          // table builder takes.
          hiddenFastEnd: FAST_END_OPINIONS.filter((o) => !selectedFastEnds.has(o.key)).map((o) => o.key),
          useElevation,
          lehumra,
          reportLocale,
        }
      : null;

  const exportTable = async (format: 'xlsx' | 'csv' | 'pdf') => {
    setError(null);
    if (rangeDays === 0) {
      setError(t('invalidRange'));
      return;
    }
    if (rangeDays > MAX_TABLE_DAYS) {
      setError(t('tooManyDays', { max: MAX_TABLE_DAYS }));
      return;
    }
    if (!hasContent) {
      setError(t('noColumns'));
      return;
    }
    setBusy(true);
    try {
      const filename = `zmanim-${startIso}_${endIso}.${format}`;

      if (format === 'pdf') {
        const { pages } = buildZmanimPdfPages(pdfConfig!);
        if (pages.length === 0) {
          setError(t('noColumns'));
          return;
        }
        const { pages: domPages, dispose } = await renderExportPages(<>{pages}</>);
        try {
          await pagesToPdf(domPages, filename);
        } finally {
          dispose();
        }
      } else {
        // The data exports keep every field atomic — "Holiday" and "Parsha"
        // separately addressable, fast bookends as columns, full locale time
        // format — because a spreadsheet wants data, not print layout.
        const dataColumns: ExportColumn[] = [
          ...(includeDate ? [{ key: 'dateLabel' as const, header: tr('export.colDate') }] : []),
          ...(includeWeekday ? [{ key: 'weekday' as const, header: tr('export.colWeekday') }] : []),
          ...(includeHebrewDate ? [{ key: 'hebrewDate' as const, header: tr('export.colHebrewDate') }] : []),
          ...(includeHoliday ? [{ key: 'holiday' as const, header: tr('export.colHoliday') }] : []),
          ...(includeParsha ? [{ key: 'parsha' as const, header: tr('export.colParsha') }] : []),
          ...(includeCandles
            ? [
                { key: 'candleLighting' as const, header: tr('events.candle') },
                { key: 'havdalah' as const, header: tr('events.havdalah') },
              ]
            : []),
          ...(includeFasts
            ? [
                { key: 'fastStart' as const, header: tr('events.fastStart') },
                { key: 'fastEnd' as const, header: tr('events.fastEnd') },
              ]
            : []),
          ...(includeMevarchim ? [{ key: 'mevarchim' as const, header: tr('panel.shabbatMevarchim') }] : []),
          ...(includeOmer ? [{ key: 'omer' as const, header: tr('export.colOmer') }] : []),
          ...learningKeys.map((key) => ({ key, header: tr(`learning.${key}`) })),
        ];
        const table = buildZmanimTable({
          start,
          end,
          keys: [...selectedKeys],
          location,
          candleLightingOffset,
          useElevation,
          lehumra,
          locale: reportLocale,
          havdalahOpinion,
          specialShabbatLabel: (name) => tr('panel.specialShabbat', { name }),
          mevarchimLabel: tr('panel.shabbatMevarchim'),
          learningKeys,
          hiddenFastEnd: FAST_END_OPINIONS.filter((o) => !selectedFastEnds.has(o.key)).map((o) => o.key),
        });
        const footer = tr('export.generatedBy', { site: SITE_HOST });
        const noteParts: string[] = [];
        if (useElevation && typeof location.elevation === 'number' && location.elevation > 0) {
          noteParts.push(tr('export.noteElevation', { meters: location.elevation }));
        }
        if (lehumra) noteParts.push(tr('export.noteLehumra'));
        const notes = noteParts.join(' · ');

        const base = buildExportGrid(table, dataColumns, table.keys.map(zmanHeader));
        const grid = transpose
          ? transposeExportGrid(
              base,
              '',
              table.rows.map((r) => r.dateLabel),
            )
          : base;

        if (format === 'xlsx') {
          await exportTableToExcel({ grid, footer, notes, rtl: reportDir === 'rtl', sheetName: 'Zmanim', filename });
        } else {
          exportTableToCsv({ grid, footer, notes, filename });
        }
      }
      // Remember the selection only once the export has actually produced a
      // file: a run that failed validation or threw is not a choice worth
      // restoring. Saved on export rather than on every tick so the prefs (and
      // the sync blob they ride in) see one write per export, not per checkbox.
      setExportPreset({
        rangeDays,
        keys: [...selectedKeys],
        learning: learningKeys,
        fastEnds: [...selectedFastEnds],
        hebrewMonths,
        columns: {
          date: includeDate,
          weekday: includeWeekday,
          hebrewDate: includeHebrewDate,
          holiday: includeHoliday,
          parsha: includeParsha,
          candles: includeCandles,
          fasts: includeFasts,
          mevarchim: includeMevarchim,
          omer: includeOmer,
        },
        transpose,
        reportLocale,
        locationId,
        useElevation,
        lehumra,
      });
    } catch {
      setError(t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    // A print dialog's shape: every control in a fixed-width start rail, the
    // live preview filling the rest and STAYING IN VIEW (sticky) while the
    // rail scrolls — it is the dialog's answer to "what will I get", so it
    // cannot live below the fold. The download buttons sit under the preview:
    // look, then print. On mobile the preview and buttons follow the range
    // and place, before the long tail of checkboxes.
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:gap-y-3">
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
            <label htmlFor="export-table-start" className={EXPORT_FIELD_LABEL}>
              {t('from')}
            </label>
            {/* The pickers follow the sheet calendar: Hebrew-month sheets are
                picked by Hebrew dates. */}
            <DatePicker
              id="export-table-start"
              mode={hebrewMonths && !transpose ? 'hebrew' : 'gregorian'}
              value={startIso}
              onChange={setStartIso}
              aria-label={t('from')}
            />
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
            <label htmlFor="export-table-end" className={EXPORT_FIELD_LABEL}>
              {t('to')}
            </label>
            <DatePicker
              id="export-table-end"
              mode={hebrewMonths && !transpose ? 'hebrew' : 'gregorian'}
              value={endIso}
              onChange={setEndIso}
              aria-label={t('to')}
            />
          </div>
          {locationField}
          {languageField}
        </div>

        {computeField}

        {/* An output option, not a content one: it changes how the sheets are
            laid out, so it belongs with elevation and lehumra rather than buried
            between the learning cycles and the zmanim picker. */}
        <div className="space-y-1.5">
          <label htmlFor="export-transpose" className="flex cursor-pointer items-center gap-2">
            <Checkbox
              id="export-transpose"
              checked={transpose}
              onCheckedChange={(v) => {
                setError(null);
                setTranspose(v === true);
              }}
            />
            <span className="text-sm font-medium">{t('transpose')}</span>
          </label>
          <p className="text-muted-foreground text-xs">{t('transposeHint')}</p>
        </div>

        {/* Hebrew-month pagination, like the calendar's Hebrew mode. Weekly
            sheets page by the week and ignore it, so it hides there. */}
        {!transpose && (
          <div className="space-y-1.5">
            <label htmlFor="export-hebrew-months" className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id="export-hebrew-months"
                checked={hebrewMonths}
                onCheckedChange={(v) => {
                  const on = v === true;
                  setHebrewMonths(on);
                  // Snap the range to the new calendar's month boundaries, so
                  // the sheets come out as whole months instead of stubs.
                  if (start.isValid && end.isValid) {
                    const from = on ? hebrewMonthSpan(start).start : start.startOf('month');
                    const to = on ? hebrewMonthSpan(end).end : end.endOf('month');
                    setStartIso(from.toISODate() ?? startIso);
                    setEndIso(to.toISODate() ?? endIso);
                  }
                }}
              />
              <span className="text-sm font-medium">{t('hebrewMonths')}</span>
            </label>
            <p className="text-muted-foreground text-xs">{t('hebrewMonthsHint')}</p>
          </div>
        )}
      </div>

      {/* The preview pane: pinned beside the rail on desktop so every tick is
          answered on the spot, with the download buttons right under it. */}
      <div className="space-y-2 lg:sticky lg:top-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <ExportPdfPreview config={pdfConfig} />
        {error && <p className="text-destructive text-xs">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={() => exportTable('pdf')} disabled={busy} className="flex-1" variant="outline">
            <FileDown className="size-4" />
            {busy ? t('generating') : t('formatPdf')}
          </Button>
          <Button onClick={() => exportTable('xlsx')} disabled={busy} className="flex-1" variant="outline">
            <FileSpreadsheet className="size-4" />
            {busy ? t('generating') : t('formatExcel')}
          </Button>
          <Button onClick={() => exportTable('csv')} disabled={busy} className="flex-1" variant="outline">
            <FileText className="size-4" />
            {busy ? t('generating') : t('formatCsv')}
          </Button>
        </div>
      </div>

      <div className="space-y-3 lg:col-start-1">
        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t('dayColumns')}</span>
          <label htmlFor="export-col-date" className="flex cursor-pointer items-center gap-2">
            <Checkbox id="export-col-date" checked={includeDate} onCheckedChange={(v) => setIncludeDate(v === true)} />
            <span className="text-sm">{t('colDate')}</span>
          </label>
          <label htmlFor="export-col-weekday" className="flex cursor-pointer items-center gap-2">
            <Checkbox id="export-col-weekday" checked={includeWeekday} onCheckedChange={(v) => setIncludeWeekday(v === true)} />
            <span className="text-sm">{t('colWeekday')}</span>
          </label>
          <label htmlFor="export-col-hebrewdate" className="flex cursor-pointer items-center gap-2">
            <Checkbox
              id="export-col-hebrewdate"
              checked={includeHebrewDate}
              onCheckedChange={(v) => setIncludeHebrewDate(v === true)}
            />
            <span className="text-sm">{t('colHebrewDate')}</span>
          </label>
          <label htmlFor="export-col-holiday" className="flex cursor-pointer items-center gap-2">
            <Checkbox id="export-col-holiday" checked={includeHoliday} onCheckedChange={(v) => setIncludeHoliday(v === true)} />
            <span className="text-sm">{t('colHoliday')}</span>
          </label>
          <label htmlFor="export-col-parsha" className="flex cursor-pointer items-center gap-2">
            <Checkbox id="export-col-parsha" checked={includeParsha} onCheckedChange={(v) => setIncludeParsha(v === true)} />
            <span className="text-sm">{t('includeParsha')}</span>
          </label>
          <label htmlFor="export-col-candles" className="flex cursor-pointer items-center gap-2">
            <Checkbox id="export-col-candles" checked={includeCandles} onCheckedChange={(v) => setIncludeCandles(v === true)} />
            <span className="text-sm">{t('includeCandles')}</span>
          </label>
          <label htmlFor="export-col-fasts" className="flex cursor-pointer items-center gap-2">
            <Checkbox id="export-col-fasts" checked={includeFasts} onCheckedChange={(v) => setIncludeFasts(v === true)} />
            <span className="text-sm">{t('includeFasts')}</span>
          </label>
          {/* The fast-end opinions the footer answers with — the whole catalog,
              not just what the calendar settings happen to show. */}
          {includeFasts && (
            <div className="ms-6 space-y-1.5">
              {FAST_END_OPINIONS.map((opinion) => (
                <label key={opinion.key} htmlFor={`export-fastend-${opinion.key}`} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    id={`export-fastend-${opinion.key}`}
                    checked={selectedFastEnds.has(opinion.key)}
                    onCheckedChange={(v) =>
                      setSelectedFastEnds((prev) => {
                        const next = new Set(prev);
                        if (v === true) next.add(opinion.key);
                        else next.delete(opinion.key);
                        return next;
                      })
                    }
                  />
                  <span className="text-muted-foreground text-xs">{tShita(fastEndZmanKey(opinion.key))}</span>
                </label>
              ))}
            </div>
          )}
          <label htmlFor="export-col-mevarchim" className="flex cursor-pointer items-center gap-2">
            <Checkbox
              id="export-col-mevarchim"
              checked={includeMevarchim}
              onCheckedChange={(v) => setIncludeMevarchim(v === true)}
            />
            <span className="text-sm">{tPanel('shabbatMevarchim')}</span>
          </label>
          <label htmlFor="export-col-omer" className="flex cursor-pointer items-center gap-2">
            <Checkbox id="export-col-omer" checked={includeOmer} onCheckedChange={(v) => setIncludeOmer(v === true)} />
            <span className="text-sm">{t('colOmer')}</span>
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium">{tLearning('title')}</span>
          <p className="text-muted-foreground text-xs">{t('learningSheetHint')}</p>
          {LEARNING_CYCLE_KEYS.map((key) => (
            <label key={key} htmlFor={`export-learn-${key}`} className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id={`export-learn-${key}`}
                checked={selectedLearning.has(key)}
                onCheckedChange={(v) => setLearningSelected(key, v === true)}
              />
              <span className="text-sm">{tLearning(key)}</span>
            </label>
          ))}
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t('zmanimPick')}</span>
          <div className="space-y-3 rounded-lg border p-3">
            {ZMAN_PICKER_SECTIONS.map((section) => (
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
                    isSelected={(k) => selectedKeys.has(k)}
                    setSelected={setKeySelected}
                    open={openBases.has(base)}
                    onToggleOpen={() => toggleBase(base)}
                    idPrefix="export-zman"
                  />
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
