'use client';

import { CalendarCog } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CANDLE_OFFSET_MAX, CANDLE_OFFSET_MIN, useAppState } from '@/components/providers/app-state';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { HAVDALAH_OPINIONS, havdalahZmanKey, type HavdalahOpinion, isHavdalahOpinion } from '@/lib/zmanim';

import { SettingsDialogShell } from './settings-shell';

/** Calendar menu: zmanim/luach preferences (candle-lighting offset, havdalah opinion). */
export function CalendarSettings() {
  const t = useTranslations('settings');
  // Same name + shita as the zmanim panel, so settings and panel stay consistent.
  // The panel shows the base name ("Tzeit ha-Kochavim") as a group header and the
  // shita ("8.5°") as the row; here we combine them so every option reads fully.
  const tName = useTranslations('zmanim.names');
  const tShita = useTranslations('zmanim.shitot');
  const { candleLightingOffset, setCandleLightingOffset, havdalahOpinion, setHavdalahOpinion } = useAppState();
  const opinionLabel = (opinion: HavdalahOpinion) => {
    const key = havdalahZmanKey(opinion);
    return `${tName(key)} · ${tShita(key)}`;
  };

  return (
    <SettingsDialogShell icon={CalendarCog} label={t('calendarOpen')} title={t('calendarTitle')}>
      <div className="space-y-2">
        <label htmlFor="candle-offset" className="text-sm font-medium">
          {t('candleOffset')}
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="candle-offset"
            type="number"
            inputMode="numeric"
            min={CANDLE_OFFSET_MIN}
            max={CANDLE_OFFSET_MAX}
            value={candleLightingOffset}
            onChange={(e) => {
              // Ignore an empty field instead of letting Number('') collapse it to 0.
              if (e.target.value === '') return;
              const n = Number(e.target.value);
              if (Number.isFinite(n)) {
                setCandleLightingOffset(Math.max(CANDLE_OFFSET_MIN, Math.min(CANDLE_OFFSET_MAX, Math.round(n))));
              }
            }}
            className="w-24"
          />
          <span className="text-muted-foreground text-sm">{t('minutes')}</span>
        </div>
        <p className="text-muted-foreground text-xs">{t('candleOffsetHint')}</p>
      </div>

      <Separator />

      <div className="space-y-2">
        <label htmlFor="havdalah-opinion" className="text-sm font-medium">
          {t('havdala')}
        </label>
        <Select value={havdalahOpinion} onValueChange={(v) => isHavdalahOpinion(v) && setHavdalahOpinion(v)}>
          <SelectTrigger id="havdalah-opinion" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HAVDALAH_OPINIONS.map((opinion) => (
              <SelectItem key={opinion} value={opinion}>
                {opinionLabel(opinion)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">{t('havdalaHint')}</p>
      </div>
    </SettingsDialogShell>
  );
}
