'use client';

import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CANDLE_OFFSET_MAX, CANDLE_OFFSET_MIN, useAppState } from '@/components/providers/app-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { LEARNING_CYCLE_KEYS } from '@/lib/learning';
import {
  CONFIGURABLE_ZMANIM,
  HAVDALAH_OPINIONS,
  havdalahZmanKey,
  type HavdalahOpinion,
  isHavdalahOpinion,
  type ZmanCategory,
} from '@/lib/zmanim';

import { SettingsDialogShell } from './settings-shell';

interface ZmanBaseEntry {
  base: string;
  /** All shitot of this base, in definition (chronological) order. */
  keys: string[];
}

interface ZmanSection {
  category: ZmanCategory;
  bases: ZmanBaseEntry[];
}

// The picker's structure (categories → bases → shitot) mirrors the zmanim
// panel exactly, so what you toggle here is what you see there. ZMANIM is
// static, so this is built once at module load.
const ZMAN_SECTIONS: ZmanSection[] = (['dawn', 'morning', 'midday', 'afternoon', 'evening'] as ZmanCategory[])
  .map((category) => {
    const bases = new Map<string, ZmanBaseEntry>();
    for (const z of CONFIGURABLE_ZMANIM.filter((z) => z.category === category)) {
      const entry = bases.get(z.base) ?? { base: z.base, keys: [] };
      entry.keys.push(z.key);
      bases.set(z.base, entry);
    }
    return { category, bases: [...bases.values()] };
  })
  .filter((s) => s.bases.length > 0);

function ZmanCheckboxRow({
  id,
  label,
  checked,
  onChange,
  muted,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (visible: boolean) => void;
  muted?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span className={muted ? 'text-muted-foreground text-xs' : 'text-sm'}>{label}</span>
    </label>
  );
}

/** Calendar menu: zmanim/luach preferences (candle-lighting offset, havdalah opinion, displayed zmanim). */
export function CalendarSettings() {
  const t = useTranslations('settings');
  // Same name + shita as the zmanim panel, so settings and panel stay consistent.
  // The panel shows the base name ("Tzeit ha-Kochavim") as a group header and the
  // shita ("8.5°") as the row; here we combine them so every option reads fully.
  const tName = useTranslations('zmanim.names');
  const tShita = useTranslations('zmanim.shitot');
  const tGroup = useTranslations('zmanim.groups');
  const tLearning = useTranslations('learning');
  const {
    location,
    candleLightingOffset,
    setCandleLightingOffset,
    useElevation,
    setUseElevation,
    havdalahOpinion,
    setHavdalahOpinion,
    hiddenZmanim,
    setZmanVisible,
    showAllZmanim,
    hiddenLearning,
    setLearningVisible,
    showAllLearning,
  } = useAppState();
  const opinionLabel = (opinion: HavdalahOpinion) => {
    const key = havdalahZmanKey(opinion);
    return `${tName(key)} · ${tShita(key)}`;
  };

  const hidden = new Set(hiddenZmanim);
  const hiddenCycles = new Set(hiddenLearning);

  return (
    <SettingsDialogShell icon={Settings} label={t('calendarOpen')} title={t('calendarTitle')} wide>
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
        <label htmlFor="use-elevation" className="flex cursor-pointer items-center gap-2">
          <Checkbox id="use-elevation" checked={useElevation} onCheckedChange={(v) => setUseElevation(v === true)} />
          <span className="text-sm font-medium">{t('elevation')}</span>
          {/* The detected elevation is shown (not edited — users don't know it;
              it's resolved from the coordinates) so the choice is informed. A
              backfilled value can be negative (Dead Sea basin); the calculator
              clamps that to sea level. */}
          {typeof location.elevation === 'number' && (
            <span className="text-muted-foreground text-xs">
              {location.elevation} {t('meters')}
            </span>
          )}
        </label>
        <p className="text-muted-foreground text-xs">{t('elevationHint')}</p>
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

      <Separator />

      {/* Sits between the event times and the zmanim picker, mirroring the
          day panel's order: masthead → daily learning → zmanim. */}
      <div className="space-y-2">
        <div className="flex min-h-8 items-center justify-between gap-2">
          <span className="text-sm font-medium">{t('learningDisplay')}</span>
          {hiddenLearning.length > 0 && (
            <Button variant="ghost" size="sm" onClick={showAllLearning}>
              {t('zmanimShowAll')}
            </Button>
          )}
        </div>
        <div className="space-y-1.5 rounded-lg border p-3">
          {LEARNING_CYCLE_KEYS.map((key) => (
            <ZmanCheckboxRow
              key={key}
              id={`learning-${key}`}
              label={tLearning(key)}
              checked={!hiddenCycles.has(key)}
              onChange={(visible) => setLearningVisible(key, visible)}
            />
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{t('learningDisplayHint')}</p>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex min-h-8 items-center justify-between gap-2">
          <span className="text-sm font-medium">{t('zmanimDisplay')}</span>
          {hiddenZmanim.length > 0 && (
            <Button variant="ghost" size="sm" onClick={showAllZmanim}>
              {t('zmanimShowAll')}
            </Button>
          )}
        </div>
        {/* The dialog body is the single scroll context (see SettingsDialogShell),
            so this list no longer scrolls on its own. */}
        <div className="space-y-3 rounded-lg border p-3">
          {ZMAN_SECTIONS.map((section) => (
            <section key={section.category} className="space-y-1.5">
              <h4 className="text-muted-foreground/70 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">
                {tGroup(section.category)}
              </h4>
              {section.bases.map(({ base, keys }) => {
                // Single opinion → one flat checkbox. Several → a parent checkbox
                // toggling the whole zman, with one checkbox per shita under it.
                if (keys.length === 1) {
                  const key = keys[0];
                  return (
                    <ZmanCheckboxRow
                      key={base}
                      id={`zman-${key}`}
                      label={tName(key)}
                      checked={!hidden.has(key)}
                      onChange={(visible) => setZmanVisible(key, visible)}
                    />
                  );
                }
                const visibleCount = keys.filter((k) => !hidden.has(k)).length;
                return (
                  <div key={base} className="space-y-1">
                    <label htmlFor={`zman-base-${base}`} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        id={`zman-base-${base}`}
                        checked={visibleCount === keys.length ? true : visibleCount === 0 ? false : 'indeterminate'}
                        // Partially shown → show all; fully shown → hide all.
                        onCheckedChange={() => {
                          const showAll = visibleCount < keys.length;
                          keys.forEach((k) => setZmanVisible(k, showAll));
                        }}
                      />
                      <span className="text-sm">{tName(keys[0])}</span>
                    </label>
                    <div className="space-y-1 ps-6">
                      {keys.map((key) => (
                        <ZmanCheckboxRow
                          key={key}
                          id={`zman-${key}`}
                          label={tShita(key)}
                          checked={!hidden.has(key)}
                          onChange={(visible) => setZmanVisible(key, visible)}
                          muted
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{t('zmanimDisplayHint')}</p>
      </div>
    </SettingsDialogShell>
  );
}
