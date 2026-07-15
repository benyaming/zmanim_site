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
 * Report-language choice: defaults to the UI language, exports can use any.
 * The option names come from the language switcher's catalog entries.
 */
export function useReportLocale(): { reportLocale: string; field: ReactNode } {
  const tLang = useTranslations('language');
  const uiLocale = useLocale();
  const [reportLocale, setReportLocale] = useState(uiLocale);

  const field = (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
      <span className="text-muted-foreground min-w-[3.75rem] text-xs">{tLang('label')}</span>
      <Select value={reportLocale} onValueChange={setReportLocale}>
        <SelectTrigger className="w-full">
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
export function useExportLocation(): { location: AppLocation; field: ReactNode } {
  const t = useTranslations('export');
  const { location: current, savedLocations } = useAppState();
  const [selectedId, setSelectedId] = useState('current');

  const entry = savedLocations.find((e) => e.id === selectedId);
  const location = entry ? resolveSavedLocation(entry) : current;
  const currentLabel = current.customLabel || current.label;

  const field =
    savedLocations.length > 0 ? (
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <span className="text-muted-foreground min-w-[3.75rem] text-xs">{t('location')}</span>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-full">
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
          <span className="text-muted-foreground min-w-[3.75rem] text-xs">{t('location')}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-sm">
            <MapPin className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate">{currentLabel}</span>
          </span>
        </div>
        <p className="text-muted-foreground text-xs">{t('locationSaveHint')}</p>
      </div>
    );

  return { location, field };
}

/**
 * Per-export computation options — elevation-adjusted times and lehumra
 * rounding — initialized from the app settings but adjustable per export.
 * The elevation checkbox shows the chosen location's detected elevation,
 * mirroring the calendar-settings row.
 */
export function useExportComputeOptions(location: AppLocation): {
  useElevation: boolean;
  lehumra: boolean;
  field: ReactNode;
} {
  const tSettings = useTranslations('settings');
  const app = useAppState();
  const [useElevation, setUseElevation] = useState(app.useElevation);
  const [lehumra, setLehumra] = useState(app.lehumra);

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
