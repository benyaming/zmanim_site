'use client';

import { MapPin } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AppLocation } from '@/lib/location';
import { resolveSavedLocation, savedLocationDisplayName } from '@/lib/saved-locations';

import { REPORT_LOCALES } from './export-i18n';

/**
 * The label cell of an export tool's field row. A FIXED width (not a minimum)
 * so every row's control starts at the same x — a long translation like
 * "Размер текста" wraps inside the cell instead of pushing its control out of
 * the column. rem-based, so it follows the accessibility text scale.
 */
export const EXPORT_FIELD_LABEL = 'text-muted-foreground w-[5.5rem] text-xs';

/**
 * Report-language choice: defaults to the UI language, exports can use any.
 * The option names come from the language switcher's catalog entries.
 *
 * `initial` restores a remembered choice (see lib/export/preset.ts). It is read
 * once, as the initial state — a tool that passes it must already be mounted
 * past prefs hydration, which the tools dialog guarantees by mounting each tool
 * only when it is opened.
 */
export function useReportLocale(initial?: string): { reportLocale: string; field: ReactNode } {
  const tLang = useTranslations('language');
  const uiLocale = useLocale();
  const [reportLocale, setReportLocale] = useState(initial ?? uiLocale);

  const field = (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
      <span className={EXPORT_FIELD_LABEL}>{tLang('label')}</span>
      <Select value={reportLocale} onValueChange={setReportLocale}>
        <SelectTrigger className="w-full" aria-label={tLang('label')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REPORT_LOCALES.map((locale) => (
            <SelectItem key={locale} value={locale}>
              {tLang(locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return { reportLocale, field };
}

/**
 * Location choice for an export: the current location by default, or any
 * saved one. Without saved locations there is nothing to pick, so the field
 * shows the current location read-only with a hint that saving locations
 * unlocks the choice.
 */
export function useExportLocation(initialId?: string): {
  location: AppLocation;
  /** 'current', or the id of the chosen saved location — for remembering the choice. */
  locationId: string;
  field: ReactNode;
} {
  const t = useTranslations('export');
  const { location: current, savedLocations } = useAppState();
  // A remembered id whose bookmark has since been deleted falls back to the
  // current location, rather than leaving the Select on a value it can't show.
  const [selectedId, setSelectedId] = useState(() =>
    initialId && initialId !== 'current' && savedLocations.some((e) => e.id === initialId) ? initialId : 'current',
  );

  const entry = savedLocations.find((e) => e.id === selectedId);
  const location = entry ? resolveSavedLocation(entry) : current;
  const currentLabel = current.customLabel || current.label;

  const field =
    savedLocations.length > 0 ? (
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <span className={EXPORT_FIELD_LABEL}>{t('location')}</span>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-full" aria-label={t('location')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">
              {currentLabel} · {t('locationCurrent')}
            </SelectItem>
            {savedLocations.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {savedLocationDisplayName(e)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) : (
      <div className="space-y-1">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
          <span className={EXPORT_FIELD_LABEL}>{t('location')}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-sm">
            <MapPin className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate">{currentLabel}</span>
          </span>
        </div>
        <p className="text-muted-foreground text-xs">{t('locationSaveHint')}</p>
      </div>
    );

  return { location, locationId: selectedId, field };
}

/**
 * Per-export computation options — elevation-adjusted times and lehumra
 * rounding — initialized from the app settings but adjustable per export.
 * The elevation checkbox shows the chosen location's detected elevation,
 * mirroring the calendar-settings row.
 */
export function useExportComputeOptions(
  location: AppLocation,
  /** Remembered per-export overrides; absent = start from the app settings. */
  initial?: { useElevation: boolean; lehumra: boolean },
): {
  useElevation: boolean;
  lehumra: boolean;
  field: ReactNode;
} {
  const tSettings = useTranslations('settings');
  const app = useAppState();
  const [useElevation, setUseElevation] = useState(initial?.useElevation ?? app.useElevation);
  const [lehumra, setLehumra] = useState(initial?.lehumra ?? app.lehumra);

  const field = (
    <div className="space-y-1.5">
      <label htmlFor="export-elevation" className="flex cursor-pointer items-center gap-2">
        <Checkbox id="export-elevation" checked={useElevation} onCheckedChange={(v) => setUseElevation(v === true)} />
        <span className="text-sm">{tSettings('elevation')}</span>
        {typeof location.elevation === 'number' && (
          <span className="text-muted-foreground text-xs">
            {location.elevation} {tSettings('meters')}
          </span>
        )}
      </label>
      <label htmlFor="export-lehumra" className="flex cursor-pointer items-center gap-2">
        <Checkbox id="export-lehumra" checked={lehumra} onCheckedChange={(v) => setLehumra(v === true)} />
        <span className="text-sm">{tSettings('lehumra')}</span>
      </label>
    </div>
  );

  return { useElevation, lehumra, field };
}
