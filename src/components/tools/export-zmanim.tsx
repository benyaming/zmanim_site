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
import {
  buildExportGrid,
  buildZmanimTable,
  dayKeys,
  DEFAULT_EXPORT_RANGE_DAYS,
  type ExportColumn,
  type ExportGrid,
  type ExportHeader,
  exportTableToCsv,
  exportTableToExcel,
  LEGIBLE_ZMAN_HINT,
  MAX_TABLE_DAYS,
  pageFootnotes,
  pagesToPdf,
  paginateExportSheets,
  tableDayCount,
  transposeExportGrid,
} from '@/lib/export';
import { LEARNING_CYCLE_KEYS, type LearningCycleKey } from '@/lib/learning';
import { SITE_HOST } from '@/lib/site';
import { CONFIGURABLE_ZMANIM, ZMANIM } from '@/lib/zmanim';

import { reportTranslator } from './export-i18n';
import { renderExportPages } from './export-render';
import { useExportComputeOptions, useExportLocation, useReportLocale } from './export-shared';
import { ExportTablePage } from './export-table-page';

/** Bases with several shitot get "name · shita" labels; single-opinion ones just the name. */
const BASE_KEY_COUNT = new Map<string, number>();
for (const z of ZMANIM) BASE_KEY_COUNT.set(z.base, (BASE_KEY_COUNT.get(z.base) ?? 0) + 1);

/** Export tool: a zmanim table over a date range, as an Excel file or a PDF. */
export function ExportZmanimTool() {
  const t = useTranslations('export');
  const tName = useTranslations('zmanim.names');
  const tShita = useTranslations('zmanim.shitot');
  const tGroup = useTranslations('zmanim.groups');
  const tPanel = useTranslations('panel');
  const tLearning = useTranslations('learning');
  const { candleLightingOffset, havdalahOpinion, hiddenZmanim, hiddenLearning, exportPreset, setExportPreset } =
    useAppState();
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
  const reportDir = dirForLocale(reportLocale) === 'rtl' ? 'rtl' : 'ltr';

  // Compact column headers (report language): drop the descriptive parenthetical
  // from the zman name — "Zman Shma (reading time)" → "Zman Shma" — so a multi-
  // shita header stays short enough to read in a narrow column.
  const shortName = (key: string) => tr(`zmanim.names.${key}`).replace(/\s*\([^)]*\)/g, '').trim();
  // A base with several shitot contributes ONE spanning header ("Alot ha-Shachar")
  // over its opinions, each labelled only by its shita underneath. CSV and Excel
  // flatten the two tiers back to "name · shita", exactly as before.
  //
  // The print sheet uses the PRINT shita labels: an authority is spelled out
  // ("Маген Авраам 72 мин"), because a printed sheet is read by people who never
  // saw the app and cannot expand "МА 72" — while a shita identified by a bare
  // degree or minute count keeps its numeral, which is already unambiguous. The
  // header wraps to three lines, so a spelled-out name costs width only up to
  // its longest single word. Full labels with their qualifiers stay in the app
  // and in the data exports, where width is free.
  const zmanHeader = (key: string): ExportHeader => {
    const def = ZMANIM.find((z) => z.key === key);
    const multi = def ? (BASE_KEY_COUNT.get(def.base) ?? 1) > 1 : false;
    return multi ? { label: shortName(key), sub: tr(`zmanim.shitot.${key}`), group: def?.base } : { label: shortName(key) };
  };
  const zmanHeaderCompact = (key: string): ExportHeader => {
    const def = ZMANIM.find((z) => z.key === key);
    const multi = def ? (BASE_KEY_COUNT.get(def.base) ?? 1) > 1 : false;
    return multi
      ? { label: shortName(key), sub: tr(`zmanim.shitotPrint.${key}`), group: def?.base }
      : { label: shortName(key) };
  };

  const today = DateTime.now().startOf('day');
  const [startIso, setStartIso] = useState(() => today.toISODate() ?? '');
  // A remembered range is re-anchored on today: the saved LENGTH is what the
  // user meant ("a month"), not the dates they happened to pick last time.
  const [endIso, setEndIso] = useState(
    () => today.plus({ days: (preset?.rangeDays ?? DEFAULT_EXPORT_RANGE_DAYS) - 1 }).toISODate() ?? '',
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () =>
      new Set(preset?.keys ?? CONFIGURABLE_ZMANIM.filter((z) => !hiddenZmanim.includes(z.key)).map((z) => z.key)),
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
  // The leading identity columns — each individually removable now.
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
  const [includeMevarchim, setIncludeMevarchim] = useState(columns?.mevarchim ?? true);
  const [includeOmer, setIncludeOmer] = useState(columns?.omer ?? true);
  // Pivot the sheet: fields down the first column, one column per day.
  const [transpose, setTranspose] = useState(preset?.transpose ?? false);
  // Daf Yomi only by default. Every cycle at once is seven wide text columns —
  // over half the sheet's width — which starves the zmanim the table exists for;
  // the rest stay one tick away. Still skipped if hidden in the panel.
  const [selectedLearning, setSelectedLearning] = useState<Set<LearningCycleKey>>(
    () => new Set(preset?.learning ?? (['dafYomi'] as LearningCycleKey[]).filter((k) => !hiddenLearning.includes(k))),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clear a failed export's message as soon as the user changes anything that
   * could have caused it. Without this the "too many zmanim" refusal stayed on
   * screen after ticking Transpose — the very fix it asks for — because the
   * message is state and was only reset at the START of the next export.
   */
  const clearError = () => setError(null);

  const setKeySelected = (key: string, selected: boolean) => {
    clearError();
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

  const exportTable = async (format: 'xlsx' | 'csv' | 'pdf') => {
    setError(null);
    const start = DateTime.fromISO(startIso);
    const end = DateTime.fromISO(endIso);
    const days = start.isValid && end.isValid ? tableDayCount(start, end) : 0;
    if (days === 0) {
      setError(t('invalidRange'));
      return;
    }
    if (days > MAX_TABLE_DAYS) {
      setError(t('tooManyDays', { max: MAX_TABLE_DAYS }));
      return;
    }
    const learningKeys = LEARNING_CYCLE_KEYS.filter((k) => selectedLearning.has(k));
    // Every enabled column, leading identity columns first, then day columns,
    // then the selected zmanim. Each identity column is individually removable.
    //
    // `compact` is the print layout. It differs from the data layout in three
    // ways, all to buy width for the times:
    //   · the three identity fields collapse into one cell ("1 Aug · 18 Av · Sat");
    //   · holiday, parsha and Shabbat Mevarchim share one events column;
    //   · the fast bookends get no column at all — they occur once or twice a
    //     month, so they ride the page footer (see `pageNotesFor`).
    // CSV and Excel keep every field atomic: a data file wants "Holiday" and
    // "Parsha" separately addressable, and width costs it nothing.
    const dayColumns = (compact: boolean, flip = transpose): ExportColumn[] => {
      const dateFields = [
        ...(includeDate ? (['dayWithMonth'] as const) : []),
        ...(includeHebrewDate ? (['hebrewDate'] as const) : []),
        ...(includeWeekday ? (['weekday'] as const) : []),
      ];
      const eventFields = [
        ...(includeHoliday ? (['holiday'] as const) : []),
        ...(includeParsha ? (['parsha'] as const) : []),
        ...(includeMevarchim ? (['mevarchimName'] as const) : []),
      ];
      if (compact) {
        return [
          // Transposed, every column is already headed by its own date, so a Date
          // ROW restates it — and restates it in a column too narrow to hold
          // "29 Jul · 15 Av · Wed", which is what printed as "29 июл. ·…".
          ...(dateFields.length > 0 && !flip
            ? [
                {
                  key: 'dayWithMonth' as const,
                  header: tr('export.colDate'),
                  fields: [...dateFields],
                  maxWeight: 4.6,
                  // The one column a stacked block repeats — it names the row.
                  identity: true,
                },
              ]
            : []),
          ...(eventFields.length > 0
            // Wide enough for the longest real value — a doubled parsha plus a
            // special-Shabbat name ("Matot-Masei · Shabbat Mevarchim") — since
            // truncating that to "Shabbat M…" loses the thing it announces.
            ? [{ key: 'events' as const, header: tr('export.colEvents'), fields: [...eventFields], maxWeight: 5 }]
            : []),
          ...(includeCandles
            ? [
                { key: 'candleLighting' as const, header: tr('events.candle'), emphasis: true },
                { key: 'havdalah' as const, header: tr('events.havdalah') },
              ]
            : []),
          ...(includeOmer ? [{ key: 'omer' as const, header: tr('export.colOmer') }] : []),
          ...learningKeys.map((key) => ({ key, header: tr(`learning.${key}`) })),
        ];
      }
      return [
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
    };
    if (dayColumns(false).length === 0 && selectedKeys.size === 0) {
      setError(t('noColumns'));
      return;
    }
    setBusy(true);
    try {
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
        moladLabel: (parts) => tr('export.moladLine', parts),
        learningKeys,
      });
      const footer = tr('export.generatedBy', { site: SITE_HOST });
      // Note the compute options that shaped the times (elevation / lehumra).
      const noteParts: string[] = [];
      if (useElevation && typeof location.elevation === 'number' && location.elevation > 0) {
        noteParts.push(tr('export.noteElevation', { meters: location.elevation }));
      }
      if (lehumra) noteParts.push(tr('export.noteLehumra'));
      const notes = noteParts.join(' · ');
      const filename = `zmanim-${startIso}_${endIso}.${format}`;

      // Transpose pivots fields ↔ days (day columns headed by the date,
      // regardless of whether the Date column itself is shown).
      const buildGrid = (compact: boolean, flip: boolean) => {
        const headers = table.keys.map(compact ? zmanHeaderCompact : zmanHeader);
        const base = buildExportGrid(table, dayColumns(compact, flip), headers);
        // Transposed, each day heads a narrow column of times, so the header has
        // to be a SHORT date: the full "29.07.2026" doesn't fit and broke across
        // lines mid-number ("29.07.202" / "6"). "29 Jul" identifies the day, and
        // the year is already in the page subtitle. Excel and CSV keep the full
        // date, where width is free.
        const dateHeads = table.rows.map((r) => (compact ? r.dayWithMonth : r.dateLabel));
        return flip ? transposeExportGrid(base, '', dateHeads) : base;
      };

      // Facts worth one footer line a month rather than a column of their own,
      // keyed off the ISO dates each page actually carries — on whichever axis the
      // days sit, since a transposed sheet has them across the top.
      const pageNotesFor = (pageGrid: ExportGrid) => pageFootnotes(table.rows, new Set(dayKeys(pageGrid)));

      if (format === 'xlsx') {
        const grid = buildGrid(false, transpose);
        await exportTableToExcel({ grid, footer, notes, rtl: reportDir === 'rtl', sheetName: 'Zmanim', filename });
      } else if (format === 'csv') {
        exportTableToCsv({ grid: buildGrid(false, transpose), footer, notes, filename });
      } else {
        // A selection too wide for one upright sheet gets TURNED: the days become
        // the columns, so the paginator can then band them a week or two to a page
        // with every selected zman present on each. Splitting the zmanim across
        // sheets instead would break the one thing the sheet must never do — leave
        // a date's times spread over two pages — and putting fewer DAYS on an
        // upright page fixes nothing, since rows and columns are independent: 45
        // zmanim is 50 columns of A4 whether the page carries 31 days or 7.
        // Too wide for one row of columns? The page STACKS instead: the same days
        // printed two or three times over, each block carrying a slice of the
        // zmanim. Every date keeps its whole answer on one sheet and every selected
        // zman is present — the two things splitting by column or by page each gave
        // up. Explicit transpose still turns the sheet, days across the top.
        const sheets = paginateExportSheets(buildGrid(true, transpose));
        const locationLabel = location.customLabel || location.label;
        const rangeLabel = `${start.setLocale(reportLocale).toLocaleString(DateTime.DATE_MED)} – ${end
          .setLocale(reportLocale)
          .toLocaleString(DateTime.DATE_MED)}`;
        const { pages: domPages, dispose } = await renderExportPages(
          <>
            {sheets.map((sheet, i) => (
              <ExportTablePage
                key={i}
                title={`${tr('export.tableTitle')} · ${locationLabel}`}
                subtitle={rangeLabel}
                pageLabel={`${i + 1} / ${sheets.length}`}
                blocks={sheet.blocks}
                fontSize={sheet.fontPx}
                footer={footer}
                notes={notes}
                pageNotes={pageNotesFor(sheet.blocks[0])}
                dir={reportDir}
              />
            ))}
          </>,
        );
        try {
          await pagesToPdf(domPages, filename);
        } finally {
          dispose();
        }
      }
      // Remember the selection only once the export has actually produced a
      // file: a run that failed validation or threw is not a choice worth
      // restoring. Saved on export rather than on every tick so the prefs (and
      // the sync blob they ride in) see one write per export, not per checkbox.
      setExportPreset({
        rangeDays: days,
        keys: [...selectedKeys],
        learning: learningKeys,
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
    // Range / location / options in a fixed-width start column, the zmanim
    // picker filling the rest. The download buttons head the end column and
    // stick there: the picker is long enough to scroll past them otherwise, and
    // they are what the dialog is for.
    <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:space-y-0">
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
            <label htmlFor="export-table-start" className="text-muted-foreground min-w-[3.75rem] text-xs">
              {t('from')}
            </label>
            <DatePicker id="export-table-start" value={startIso} onChange={setStartIso} aria-label={t('from')} />
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
            <label htmlFor="export-table-end" className="text-muted-foreground min-w-[3.75rem] text-xs">
              {t('to')}
            </label>
            <DatePicker id="export-table-end" value={endIso} onChange={setEndIso} aria-label={t('to')} />
          </div>
          {locationField}
          {languageField}
        </div>

        {computeField}

        {/* An output option, not a content one: it changes how the sheet is laid
            out, so it belongs with elevation and lehumra rather than buried
            between the learning cycles and the zmanim picker. */}
        <div className="space-y-1.5">
          <label htmlFor="export-transpose" className="flex cursor-pointer items-center gap-2">
            <Checkbox
              id="export-transpose"
              checked={transpose}
              onCheckedChange={(v) => {
                clearError();
                setTranspose(v === true);
              }}
            />
            <span className="text-sm font-medium">{t('transpose')}</span>
          </label>
          <p className="text-muted-foreground text-xs">{t('transposeHint')}</p>
        </div>

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

      </div>

      {/* self-stretch so this column runs the full height of the taller of the
          two: the picker ends before the options do, and a bar pinned to the
          bottom of a short column would stop sticking partway down the scroll. */}
      <div className="flex flex-col gap-2 lg:col-start-2 lg:row-start-1 lg:self-stretch">
        <span className="text-sm font-medium">{t('zmanimPick')}</span>
        <div className="space-y-3 rounded-lg border p-3 lg:columns-2 lg:gap-x-6">
          {ZMAN_PICKER_SECTIONS.map((section) => (
            <section key={section.category} className="space-y-1.5 lg:break-inside-avoid">
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

        {/* The download buttons keep their original place at the bottom, but
            pinned there so they stay reachable however far down the picker you
            are. `bottom-0` would pin to the scroll container's PADDING edge,
            leaving a live strip below it — hence the -1 offset and matching
            padding, which also cancels out while the bar is unstuck. */}
        <div className="bg-background sticky -bottom-1 z-10 mt-auto -mb-1 space-y-2 pt-2 pb-1">
          {/* Said before the click, so a wide selection isn't a surprise at
              download time. Advisory: the real verdict comes from measuring the
              fitted layout, which is why this doesn't disable anything. */}
          {selectedKeys.size > LEGIBLE_ZMAN_HINT && !transpose && (
            <p className="text-muted-foreground text-xs">{t('tooManyZmanimHint')}</p>
          )}
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
      </div>
    </div>
  );
}
