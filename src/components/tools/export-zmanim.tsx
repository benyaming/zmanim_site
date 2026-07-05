'use client';

import { FileDown, FileSpreadsheet } from 'lucide-react';
import { DateTime } from 'luxon';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { dirForLocale } from '@/i18n/routing';
import {
  buildZmanimTable,
  type DayColumnKey,
  exportTableToExcel,
  MAX_TABLE_DAYS,
  pagesToPdf,
  tableDayCount,
} from '@/lib/export';
import { SITE_HOST } from '@/lib/site';
import { CONFIGURABLE_ZMANIM, type ZmanCategory, ZMANIM } from '@/lib/zmanim';

import { reportTranslator } from './export-i18n';
import { renderExportPages } from './export-render';
import { useExportComputeOptions, useExportLocation, useReportLocale } from './export-shared';
import { ExportTablePage, TABLE_ROWS_PER_PAGE } from './export-table-page';

// Picker structure: categories → keys, mirroring the calendar-settings picker.
interface ZmanSection {
  category: ZmanCategory;
  keys: string[];
}

const ZMAN_SECTIONS: ZmanSection[] = (['dawn', 'morning', 'midday', 'afternoon', 'evening'] as ZmanCategory[])
  .map((category) => ({ category, keys: CONFIGURABLE_ZMANIM.filter((z) => z.category === category).map((z) => z.key) }))
  .filter((s) => s.keys.length > 0);

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
  const { candleLightingOffset, havdalahOpinion, hiddenZmanim } = useAppState();
  const { location, field: locationField } = useExportLocation();
  const { reportLocale, field: languageField } = useReportLocale();
  const { useElevation, lehumra, field: computeField } = useExportComputeOptions(location);

  // Report content follows the chosen report language; the dialog (incl. the
  // zmanim picker) stays in the UI language.
  const tr = reportTranslator(reportLocale);
  const reportDir = dirForLocale(reportLocale) === 'rtl' ? 'rtl' : 'ltr';

  /** Picker labels — UI language. */
  const zmanLabel = (key: string) => {
    const def = ZMANIM.find((z) => z.key === key);
    const multi = def ? (BASE_KEY_COUNT.get(def.base) ?? 1) > 1 : false;
    return multi ? `${tName(key)} · ${tShita(key)}` : tName(key);
  };
  /** Column headers — report language. */
  const zmanHeader = (key: string) => {
    const def = ZMANIM.find((z) => z.key === key);
    const multi = def ? (BASE_KEY_COUNT.get(def.base) ?? 1) > 1 : false;
    const name = tr(`zmanim.names.${key}`);
    return multi ? `${name} · ${tr(`zmanim.shitot.${key}`)}` : name;
  };

  const today = DateTime.now().startOf('day');
  const [startIso, setStartIso] = useState(() => today.toISODate() ?? '');
  const [endIso, setEndIso] = useState(() => today.plus({ days: 30 }).toISODate() ?? '');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(CONFIGURABLE_ZMANIM.filter((z) => !hiddenZmanim.includes(z.key)).map((z) => z.key)),
  );
  // The combined day columns: parsha (+ special Shabbat name), candle
  // lighting + havdalah, and the fast bookends.
  const [includeParsha, setIncludeParsha] = useState(true);
  const [includeCandles, setIncludeCandles] = useState(true);
  const [includeFasts, setIncludeFasts] = useState(true);
  const [includeMevarchim, setIncludeMevarchim] = useState(true);
  const [includeOmer, setIncludeOmer] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setKeySelected = (key: string, selected: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (selected) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const exportTable = async (format: 'xlsx' | 'pdf') => {
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
    if (selectedKeys.size === 0) {
      setError(t('noZmanim'));
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
      });
      const fixedHeaders = [
        tr('export.colDate'),
        tr('export.colWeekday'),
        tr('export.colHebrewDate'),
        tr('export.colHoliday'),
      ];
      const dayColumns: { key: DayColumnKey; header: string }[] = [
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
      ];
      const zmanHeaders = table.keys.map(zmanHeader);
      const footer = tr('export.generatedBy', { site: SITE_HOST });
      const filename = `zmanim-${startIso}_${endIso}.${format}`;

      if (format === 'xlsx') {
        await exportTableToExcel({
          table,
          fixedHeaders,
          dayColumns,
          zmanHeaders,
          footer,
          rtl: reportDir === 'rtl',
          sheetName: 'Zmanim',
          filename,
        });
      } else {
        const pageCount = Math.ceil(table.rows.length / TABLE_ROWS_PER_PAGE);
        const locationLabel = location.customLabel || location.label;
        const rangeLabel = `${start.setLocale(reportLocale).toLocaleString(DateTime.DATE_MED)} – ${end
          .setLocale(reportLocale)
          .toLocaleString(DateTime.DATE_MED)}`;
        const { pages, dispose } = await renderExportPages(
          <>
            {Array.from({ length: pageCount }, (_, i) => (
              <ExportTablePage
                key={i}
                title={`${tr('export.tableTitle')} · ${locationLabel}`}
                subtitle={rangeLabel}
                pageLabel={`${i + 1} / ${pageCount}`}
                fixedHeaders={fixedHeaders}
                dayColumns={dayColumns}
                zmanHeaders={zmanHeaders}
                rows={table.rows.slice(i * TABLE_ROWS_PER_PAGE, (i + 1) * TABLE_ROWS_PER_PAGE)}
                footer={footer}
                dir={reportDir}
              />
            ))}
          </>,
        );
        try {
          await pagesToPdf(pages, filename);
        } finally {
          dispose();
        }
      }
    } catch {
      setError(t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    // Mobile: one stacked column (buttons last). Desktop: range/location/options
    // and the download buttons in a fixed-width start column, the zmanim picker
    // filling the rest of the width alongside.
    <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:gap-y-4 lg:space-y-0">
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor="export-table-start" className="text-muted-foreground w-10 shrink-0 text-xs">
              {t('from')}
            </label>
            <Input id="export-table-start" type="date" value={startIso} onChange={(e) => setStartIso(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="export-table-end" className="text-muted-foreground w-10 shrink-0 text-xs">
              {t('to')}
            </label>
            <Input id="export-table-end" type="date" value={endIso} onChange={(e) => setEndIso(e.target.value)} />
          </div>
          {locationField}
          {languageField}
        </div>

        {computeField}

        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t('dayColumns')}</span>
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
      </div>

      <div className="space-y-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <span className="text-sm font-medium">{t('zmanimPick')}</span>
        <div className="space-y-3 rounded-lg border p-3 lg:columns-2 lg:gap-x-10">
          {ZMAN_SECTIONS.map((section) => (
            <section key={section.category} className="space-y-1.5 lg:break-inside-avoid">
              <h4 className="text-muted-foreground/70 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">
                {tGroup(section.category)}
              </h4>
              {section.keys.map((key) => (
                <label key={key} htmlFor={`export-zman-${key}`} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    id={`export-zman-${key}`}
                    checked={selectedKeys.has(key)}
                    onCheckedChange={(v) => setKeySelected(key, v === true)}
                  />
                  <span className="text-sm">{zmanLabel(key)}</span>
                </label>
              ))}
            </section>
          ))}
        </div>
      </div>

      <div className="space-y-3 lg:col-start-1 lg:row-start-2">
        {error && <p className="text-destructive text-xs">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={() => exportTable('xlsx')} disabled={busy} className="flex-1" variant="outline">
            <FileSpreadsheet className="size-4" />
            {busy ? t('generating') : t('downloadExcel')}
          </Button>
          <Button onClick={() => exportTable('pdf')} disabled={busy} className="flex-1">
            <FileDown className="size-4" />
            {busy ? t('generating') : t('download')}
          </Button>
        </div>
      </div>
    </div>
  );
}
