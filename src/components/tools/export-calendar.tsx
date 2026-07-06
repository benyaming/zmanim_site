'use client';

import { JewishDate } from 'kosher-zmanim';
import { FileDown } from 'lucide-react';
import { DateTime, Info as LuxonInfo } from 'luxon';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type RefObject } from 'react';

import { useAccessibility, type FontScale } from '@/components/providers/accessibility-provider';
import { useAppState } from '@/components/providers/app-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { dirForLocale } from '@/i18n/routing';
import { SITE_HOST } from '@/lib/site';
import { type CalendarMode, monthAnchor } from '@/lib/calendar';
import {
  hebrewMonthAnchor,
  hebrewMonthsOfYear,
  MAX_GRID_MONTHS,
  monthsInRange,
  PAGE_HEIGHT_PX,
  PAGE_WIDTH_PX,
  pagesToPdf,
} from '@/lib/export';

import {
  buildExportMonth,
  EXPORT_GRID_THEMES,
  type ExportGridTheme,
  type ExportMonthCfg,
  ExportMonthPage,
} from './export-month';
import { reportTranslator } from './export-i18n';
import { renderExportPages } from './export-render';
import { useExportComputeOptions, useExportLocation, useReportLocale } from './export-shared';

/** The appearance menu's text-size steps (see --ui-scale in globals.css), applied to the page type. */
const TEXT_SCALES: Record<FontScale, number> = { default: 1, lg: 1.125, xl: 1.25, xxl: 1.4 };
const FONT_SCALE_KEYS: FontScale[] = ['default', 'lg', 'xl', 'xxl'];

/** Month + year pickers for one end of the range, in the active calendar mode. */
function MonthField({
  label,
  mode,
  value,
  onChange,
  locale,
}: {
  label: string;
  mode: CalendarMode;
  /** Month anchor (the 15th) in the active mode. */
  value: DateTime;
  onChange: (anchor: DateTime) => void;
  locale: string;
}) {
  if (mode === 'hebrew') {
    const jd = new JewishDate(value);
    const year = jd.getJewishYear();
    const month = jd.getJewishMonth();
    return (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-10 shrink-0 text-xs">{label}</span>
        <Select value={String(month)} onValueChange={(v) => onChange(hebrewMonthAnchor(year, Number(v)))}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {hebrewMonthsOfYear(year, locale).map((m) => (
              <SelectItem key={m.month} value={String(m.month)}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          key={`he-${year}`}
          type="number"
          inputMode="numeric"
          defaultValue={year}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 4000 && n <= 6999) onChange(hebrewMonthAnchor(n, month));
          }}
          className="w-24"
          aria-label={label}
        />
      </div>
    );
  }

  const months = LuxonInfo.months('long', { locale });
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-10 shrink-0 text-xs">{label}</span>
      <Select
        value={String(value.month)}
        onValueChange={(v) => onChange(DateTime.fromObject({ year: value.year, month: Number(v), day: 15 }))}
      >
        <SelectTrigger className="flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((name, i) => (
            <SelectItem key={name} value={String(i + 1)}>
              <span className="capitalize">{name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        key={`greg-${value.year}`}
        type="number"
        inputMode="numeric"
        defaultValue={value.year}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isInteger(n) && n >= 1600 && n <= 2400) {
            onChange(DateTime.fromObject({ year: n, month: value.month, day: 15 }));
          }
        }}
        className="w-24"
        aria-label={label}
      />
    </div>
  );
}

/** Fit the fixed-size preview page to the dialog width. */
function usePreviewScale(ref: RefObject<HTMLDivElement | null>): number {
  const [scale, setScale] = useState(0.35);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0) setScale(el.clientWidth / PAGE_WIDTH_PX);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

/** Export tool: the month grid as print-ready PDF pages, one month per page. */
export function ExportCalendarTool() {
  const t = useTranslations('export');
  const tCal = useTranslations('calendar');
  const tSettings = useTranslations('settings');
  const locale = useLocale();
  const { monthDate, mode, candleLightingOffset, havdalahOpinion, customDates } = useAppState();
  const { fontScale: appFontScale } = useAccessibility();
  const [includeCustomDates, setIncludeCustomDates] = useState(true);

  const { location, field: locationField } = useExportLocation();
  const { reportLocale, field: languageField } = useReportLocale();
  const { useElevation, lehumra, field: computeField } = useExportComputeOptions(location);
  const [fontScale, setFontScale] = useState<FontScale>(appFontScale);

  // Report content follows the chosen report language (labels, month names,
  // time formats, direction) — the dialog itself stays in the UI language.
  const tr = reportTranslator(reportLocale);
  const reportDir = dirForLocale(reportLocale) === 'rtl' ? 'rtl' : 'ltr';
  const cfg: ExportMonthCfg = {
    locale: reportLocale,
    location,
    candleLightingOffset,
    havdalahOpinion,
    useElevation,
    lehumra,
    customDates: includeCustomDates ? customDates : [],
    labels: {
      roshChodesh: tr('categories.roshChodesh'),
      mevarchim: tr('panel.shabbatMevarchim'),
      omer: (day: number) => tr('panel.omer', { day }),
      specialShabbat: (name: string) => tr('panel.specialShabbat', { name }),
      customDate: (kind) => tr(`customDates.kind${kind[0].toUpperCase()}${kind.slice(1)}`),
    },
  };

  const [gridMode, setGridMode] = useState<CalendarMode>(mode);
  const [start, setStart] = useState<DateTime>(() => monthAnchor(monthDate, mode));
  const [end, setEnd] = useState<DateTime>(() => monthAnchor(monthDate, mode));
  const [theme, setTheme] = useState<ExportGridTheme>('color');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (m: CalendarMode) => {
    setGridMode(m);
    setStart((prev) => monthAnchor(prev, m));
    setEnd((prev) => monthAnchor(prev, m));
  };

  const footer = tr('export.generatedBy', { site: SITE_HOST });
  const previewRef = useRef<HTMLDivElement>(null);
  const previewScale = usePreviewScale(previewRef);
  const previewData = buildExportMonth(start, gridMode, cfg);

  const exportGrid = async () => {
    setError(null);
    const months = monthsInRange(start, end, gridMode);
    if (months.length === 0) {
      setError(t('invalidRange'));
      return;
    }
    if (months.length > MAX_GRID_MONTHS) {
      setError(t('tooManyMonths', { max: MAX_GRID_MONTHS }));
      return;
    }
    setBusy(true);
    try {
      const pagesData = months.map((m) => buildExportMonth(m, gridMode, cfg));
      const { pages, dispose } = await renderExportPages(
        <>
          {pagesData.map((data, i) => (
            <ExportMonthPage key={i} data={data} theme={theme} dir={reportDir} textScale={TEXT_SCALES[fontScale]} footer={footer} />
          ))}
        </>,
      );
      try {
        const tag = (d: DateTime) => d.toFormat('yyyy-LL');
        await pagesToPdf(pages, `calendar-${tag(months[0])}_${tag(months[months.length - 1])}.pdf`);
      } finally {
        dispose();
      }
    } catch {
      setError(t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    // Mobile: one stacked column. Desktop: controls in a fixed-width start
    // column, with the (much larger) live preview using the rest of the width.
    <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:space-y-0">
      <div className="space-y-3">
      <ToggleGroup
        type="single"
        value={gridMode}
        onValueChange={(v) => v && switchMode(v as CalendarMode)}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="gregorian">{tCal('civil')}</ToggleGroupItem>
        <ToggleGroupItem value="hebrew">{tCal('hebrew')}</ToggleGroupItem>
      </ToggleGroup>

      <div className="space-y-2">
        <MonthField label={t('from')} mode={gridMode} value={start} onChange={setStart} locale={locale} />
        <MonthField label={t('to')} mode={gridMode} value={end} onChange={setEnd} locale={locale} />
        {locationField}
        {languageField}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-10 shrink-0 text-xs">{t('theme')}</span>
        <ToggleGroup
          type="single"
          value={theme}
          onValueChange={(v) => v && setTheme(v as ExportGridTheme)}
          variant="outline"
          size="sm"
        >
          {EXPORT_GRID_THEMES.map((option) => (
            <ToggleGroupItem key={option} value={option}>
              {t(option === 'color' ? 'themeColor' : option === 'mono' ? 'themeMono' : 'themeDark')}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-10 shrink-0 text-xs">{tSettings('textSize')}</span>
        <Select value={fontScale} onValueChange={(v) => setFontScale(v as FontScale)}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_SCALE_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {tSettings(`size_${key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {computeField}

      {customDates.length > 0 && (
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox checked={includeCustomDates} onCheckedChange={(v) => setIncludeCustomDates(v === true)} />
          <span className="text-sm">{t('includeCustomDates')}</span>
        </label>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}
      <Button onClick={exportGrid} disabled={busy} className="w-full">
        <FileDown className="size-4" />
        {busy ? t('generating') : t('download')}
      </Button>
      </div>

      {/* Live preview: the real page component, scaled to its column width. */}
      <div className="mt-3 space-y-1 lg:mt-0">
        <span className="text-muted-foreground text-xs">{t('preview')}</span>
        <div ref={previewRef} className="overflow-hidden rounded-md border shadow-sm">
          {/* The page overflows the wrapper toward the inline-end before
              scaling, so the origin must be the top inline-START corner — the
              scaled width then fills the wrapper exactly in both directions. */}
          <div style={{ height: PAGE_HEIGHT_PX * previewScale }}>
            <div className="origin-top-left rtl:origin-top-right" style={{ transform: `scale(${previewScale})` }}>
              <ExportMonthPage data={previewData} theme={theme} dir={reportDir} textScale={TEXT_SCALES[fontScale]} footer={footer} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
