'use client';

import { DateTime } from 'luxon';
import type { ReactNode } from 'react';

import { dirForLocale } from '@/i18n/routing';
import {
  alternateMonthsTitle,
  buildExportDocument,
  buildZmanimTable,
  type ExportColumn,
  type ExportDocSheet,
  type ExportHeader,
  monthTitle,
} from '@/lib/export';
import type { LearningCycleKey } from '@/lib/learning';
import type { AppLocation } from '@/lib/location';
import { SITE_HOST } from '@/lib/site';
import { type HavdalahOpinion, havdalahZmanKey, ZMANIM } from '@/lib/zmanim';

import { reportTranslator } from './export-i18n';
import { ExportTablePage } from './export-table-page';

/** Bases with several shitot get a spanning name + per-opinion sub-label. */
const BASE_KEY_COUNT = new Map<string, number>();
for (const z of ZMANIM) BASE_KEY_COUNT.set(z.base, (BASE_KEY_COUNT.get(z.base) ?? 0) + 1);

export interface PdfColumnFlags {
  date: boolean;
  weekday: boolean;
  hebrewDate: boolean;
  holiday: boolean;
  parsha: boolean;
  candles: boolean;
  fasts: boolean;
  mevarchim: boolean;
  omer: boolean;
}

/** Everything the PDF document depends on — one plain object, so the live preview can rebuild from it. */
export interface PdfDocConfig {
  startIso: string;
  endIso: string;
  /** Selected zman keys (any order). */
  keys: string[];
  learningKeys: LearningCycleKey[];
  columns: PdfColumnFlags;
  /** Weekly layout (one calendar week per sheet) instead of month sheets. */
  weekly: boolean;
  /** Page by Hebrew month (a sheet per Elul) instead of civil month. */
  hebrewMonths: boolean;
  location: AppLocation;
  locationLabel: string;
  candleLightingOffset: number;
  havdalahOpinion: HavdalahOpinion;
  /** The user's hidden fast-end opinions, so the fast footnote answers with the ones they show. */
  hiddenFastEnd: string[];
  useElevation: boolean;
  lehumra: boolean;
  reportLocale: string;
}

/**
 * Build the whole PDF document as rendered pages: the zmanim table with
 * plain print-style times ("4:53", no AM/PM — column context disambiguates,
 * as on every printed luach), the fitted sheets, and one ExportTablePage per
 * sheet. Shared verbatim by the download path and the dialog preview, so the
 * preview IS the export.
 */
export function buildZmanimPdfPages(cfg: PdfDocConfig): { pages: ReactNode[]; sheets: ExportDocSheet[] } {
  const tr = reportTranslator(cfg.reportLocale);
  const dir = dirForLocale(cfg.reportLocale) === 'rtl' ? 'rtl' : 'ltr';
  const start = DateTime.fromISO(cfg.startIso);
  const end = DateTime.fromISO(cfg.endIso);

  const table = buildZmanimTable({
    start,
    end,
    keys: cfg.keys,
    location: cfg.location,
    candleLightingOffset: cfg.candleLightingOffset,
    useElevation: cfg.useElevation,
    lehumra: cfg.lehumra,
    locale: cfg.reportLocale,
    havdalahOpinion: cfg.havdalahOpinion,
    specialShabbatLabel: (name) => tr('panel.specialShabbat', { name }),
    mevarchimLabel: cfg.columns.mevarchim ? tr('panel.shabbatMevarchim') : undefined,
    // The molad footnote follows the Mevarchim toggle: both are the "Shabbat
    // announcements" material.
    moladLabel: cfg.columns.mevarchim ? (parts) => tr('export.moladLine', parts) : undefined,
    learningKeys: cfg.learningKeys,
    plainTimes: true,
    hiddenFastEnd: cfg.hiddenFastEnd,
    fastEndLabel: (key) => tr(`events.fastEndOpinions.${key}`),
  });

  // Compact print headers: the parenthetical qualifier is dropped from the
  // zman name — "Zman Shma (reading time)" → "Zman Shma" — and multi-shita
  // bases span their opinions, labelled by the curated SHORT shita vocabulary
  // ("MGA 16.1°", "GRA") on month sheets. The weekly sheet spells the shita
  // out (`shitotPrint`) instead: its label column has the width, and a sheet
  // read by people who never saw the app shouldn't make them expand "МА 72".
  const shortName = (key: string) =>
    tr(`zmanim.names.${key}`)
      .replace(/\s*\([^)]*\)/g, '')
      .trim();
  const zmanHeader = (key: string): ExportHeader => {
    const def = ZMANIM.find((z) => z.key === key);
    const multi = def ? (BASE_KEY_COUNT.get(def.base) ?? 1) > 1 : false;
    if (!multi) return { label: shortName(key) };
    return {
      label: shortName(key),
      sub: tr(`zmanim.${cfg.weekly ? 'shitotPrint' : 'shitotShort'}.${key}`),
      group: def?.base,
    };
  };

  // The day columns, compact: the enabled date fields merge into ONE identity
  // cell and the day's happenings into one events cell. The calendar the sheet
  // is PAGED BY contributes only its day number — its month is already in the
  // sheet's title, and repeating it on thirty rows was pure noise — while the
  // other calendar keeps its month names, which do change mid-sheet.
  const monthly = !cfg.weekly;
  const dateFields = cfg.hebrewMonths
    ? [
        ...(cfg.columns.hebrewDate ? ([monthly ? 'hebrewDay' : 'hebrewDate'] as const) : []),
        ...(cfg.columns.date ? (['dayWithMonth'] as const) : []),
        ...(cfg.columns.weekday ? (['weekday'] as const) : []),
      ]
    : [
        ...(cfg.columns.date ? ([monthly ? 'dayOfMonth' : 'dayWithMonth'] as const) : []),
        ...(cfg.columns.hebrewDate ? (['hebrewDate'] as const) : []),
        ...(cfg.columns.weekday ? (['weekday'] as const) : []),
      ];
  const eventFields = [
    ...(cfg.columns.holiday ? (['holiday'] as const) : []),
    ...(cfg.columns.parsha ? (['parsha'] as const) : []),
    ...(cfg.columns.mevarchim ? (['mevarchimName'] as const) : []),
  ];
  const dayColumns: ExportColumn[] = [
    ...(dateFields.length > 0
      ? [
          {
            key: 'dayWithMonth' as const,
            header: tr('export.colDate'),
            fields: [...dateFields],
            maxWeight: 4.6,
            identity: true,
          },
        ]
      : []),
    ...(eventFields.length > 0
      ? [{ key: 'events' as const, header: tr('export.colEvents'), fields: [...eventFields], maxWeight: 5 }]
      : []),
    ...(cfg.columns.candles
      ? [
          { key: 'candleLighting' as const, header: tr('events.candle'), emphasis: true },
          { key: 'havdalah' as const, header: tr('events.havdalah') },
        ]
      : []),
    ...(cfg.columns.omer ? [{ key: 'omer' as const, header: tr('export.colOmer') }] : []),
  ];

  const sheets = buildExportDocument({
    table,
    dayColumns,
    zmanHeaders: table.keys.map(zmanHeader),
    learningColumns: cfg.learningKeys.map((key) => ({ key, header: tr(`learning.${key}`) })),
    weekly: cfg.weekly,
    hebrewMonths: cfg.hebrewMonths,
    includeFastNotes: cfg.columns.fasts,
  });

  const footer = tr('export.generatedBy', { site: SITE_HOST });
  // The calculation line: everything that shaped these times, so a printed
  // sheet answers "which opinions is this?" without the app in hand. The
  // havdala item goes LAST because its opinion label carries a " · " of its
  // own ("3 small stars · 8.5°") — mid-list it would read as two items.
  const noteParts: string[] = [tr('export.noteCandles', { minutes: cfg.candleLightingOffset })];
  if (cfg.useElevation && typeof cfg.location.elevation === 'number' && cfg.location.elevation > 0) {
    noteParts.push(tr('export.noteElevation', { meters: cfg.location.elevation }));
  }
  if (cfg.lehumra) noteParts.push(tr('export.noteLehumra'));
  noteParts.push(tr('export.noteHavdalah', { opinion: tr(`zmanim.shitot.${havdalahZmanKey(cfg.havdalahOpinion)}`) }));
  const notes = noteParts.join(' · ');

  const titleFor = (sheet: ExportDocSheet) =>
    `${sheet.kind === 'learning' ? tr('learning.title') : tr('export.tableTitle')} · ${cfg.locationLabel}`;
  const subtitleFor = (sheet: ExportDocSheet) => {
    const part = sheet.parts > 1 ? ` · ${sheet.part}/${sheet.parts}` : '';
    if (sheet.kind === 'week') {
      const from = DateTime.fromISO(sheet.startIso).setLocale(cfg.reportLocale).toLocaleString(DateTime.DATE_MED);
      const to = DateTime.fromISO(sheet.endIso).setLocale(cfg.reportLocale).toLocaleString(DateTime.DATE_MED);
      return `${from} – ${to}${part}`;
    }
    // The month in both calendars, like the app header: "September 2026 ·
    // Elul 5786 – Tishrei 5787" — or Hebrew-first when paging by Hebrew month.
    const month = DateTime.fromISO(sheet.startIso);
    const mode = cfg.hebrewMonths ? 'hebrew' : 'gregorian';
    return `${monthTitle(month, mode, cfg.reportLocale)} · ${alternateMonthsTitle(month, mode, cfg.reportLocale)}${part}`;
  };

  const pages = sheets.map((sheet, i) => (
    <ExportTablePage
      key={i}
      title={titleFor(sheet)}
      subtitle={subtitleFor(sheet)}
      pageLabel={`${i + 1} / ${sheets.length}`}
      sheet={sheet}
      footer={footer}
      notes={notes}
      notesLabel={tr('export.noteCalculation')}
      dir={dir}
    />
  ));

  return { pages, sheets };
}
