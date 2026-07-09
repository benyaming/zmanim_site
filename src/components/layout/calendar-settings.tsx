'use client';

import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { CANDLE_OFFSET_MAX, CANDLE_OFFSET_MIN, useAppState } from '@/components/providers/app-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ZMAN_PICKER_SECTIONS, ZmanBaseControl } from '@/components/zmanim/zman-picker';
import { FAST_END_OPINIONS, type FastEndKind } from '@/lib/calendar';
import { LEARNING_CYCLE_KEYS } from '@/lib/learning';
import { HAVDALAH_OPINIONS, havdalahZmanKey, type HavdalahOpinion, isHavdalahOpinion } from '@/lib/zmanim';

import { SettingsDialogShell } from './settings-shell';

// Fast-end opinions grouped by severity, for the picker: gmar-taanis (three
// medium stars — minor fasts) then nightfall (three small stars — all fasts).
const FAST_END_GROUPS: { kind: FastEndKind; keys: string[] }[] = (['gmarTaanis', 'nightfall'] as FastEndKind[]).map(
  (kind) => ({ kind, keys: FAST_END_OPINIONS.filter((o) => o.kind === kind).map((o) => o.key) }),
);

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
  // The lehumra explanation is shared with the day panel's chip/footnote
  // popover, so settings and panel always describe the same rules.
  const tPanel = useTranslations('panel');
  // Same name + shita as the zmanim panel, so settings and panel stay consistent.
  // The panel shows the base name ("Tzeit ha-Kochavim") as a group header and the
  // shita ("8.5°") as the row; here we combine them so every option reads fully.
  const tName = useTranslations('zmanim.names');
  const tShita = useTranslations('zmanim.shitot');
  const tGroup = useTranslations('zmanim.groups');
  const tLearning = useTranslations('learning');
  const tFastEnd = useTranslations('events.fastEndOpinions');
  const tFastEndKind = useTranslations('events.fastEndKinds');
  const {
    location,
    candleLightingOffset,
    setCandleLightingOffset,
    useElevation,
    setUseElevation,
    havdalahOpinion,
    setHavdalahOpinion,
    lehumra,
    setLehumra,
    hiddenZmanim,
    setZmanVisible,
    showAllZmanim,
    hiddenLearning,
    setLearningVisible,
    showAllLearning,
    hiddenFastEnd,
    setFastEndVisible,
    showAllFastEnd,
  } = useAppState();
  const opinionLabel = (opinion: HavdalahOpinion) => {
    const key = havdalahZmanKey(opinion);
    return `${tName(key)} · ${tShita(key)}`;
  };

  // Which multi-shita bases are expanded in the picker. All collapsed by
  // default so the list stays one row per zman; the shown/total count conveys
  // state without opening them.
  const [openBases, setOpenBases] = useState<Set<string>>(new Set());
  const toggleBase = (base: string) =>
    setOpenBases((prev) => {
      const next = new Set(prev);
      if (next.has(base)) next.delete(base);
      else next.add(base);
      return next;
    });

  const hidden = new Set(hiddenZmanim);
  const hiddenCycles = new Set(hiddenLearning);
  const hiddenFast = new Set(hiddenFastEnd);

  return (
    <SettingsDialogShell icon={Settings} label={t('calendarOpen')} title={t('calendarTitle')} wide>
      {/* One column on small screens (ruled by separators); two columns on
          desktop, where the separators disappear and the big zmanim picker
          spans the full width with its sections flowing in two columns. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-x-10">
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

      <Separator className="lg:hidden" />

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

      <Separator className="lg:hidden" />

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

      <Separator className="lg:hidden" />

      <div className="space-y-2">
        <label htmlFor="lehumra" className="flex cursor-pointer items-center gap-2">
          <Checkbox id="lehumra" checked={lehumra} onCheckedChange={(v) => setLehumra(v === true)} />
          <span className="text-sm font-medium">{t('lehumra')}</span>
        </label>
        <p className="text-muted-foreground text-xs whitespace-pre-line">{tPanel('lehumraDetail')}</p>
      </div>

      <Separator className="lg:hidden" />

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

      <Separator className="lg:hidden" />

      {/* Which end-of-fast opinions appear on a fast day. Grouped by severity:
          gmar-taanis (three medium stars — minor fasts) and nightfall (three
          small stars — all fasts, incl. Tisha b'Av). */}
      <div className="space-y-2">
        <div className="flex min-h-8 items-center justify-between gap-2">
          <span className="text-sm font-medium">{t('fastEndDisplay')}</span>
          {hiddenFastEnd.length > 0 && (
            <Button variant="ghost" size="sm" onClick={showAllFastEnd}>
              {t('zmanimShowAll')}
            </Button>
          )}
        </div>
        <div className="space-y-2.5 rounded-lg border p-3">
          {FAST_END_GROUPS.map(({ kind, keys }) => (
            <div key={kind} className="space-y-1.5">
              <h5 className="text-muted-foreground/70 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">
                {tFastEndKind(kind)}
              </h5>
              {keys.map((key) => (
                <ZmanCheckboxRow
                  key={key}
                  id={`fastend-${key}`}
                  label={tFastEnd(key)}
                  checked={!hiddenFast.has(key)}
                  onChange={(visible) => setFastEndVisible(key, visible)}
                />
              ))}
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{t('fastEndDisplayHint')}</p>
      </div>

      <Separator className="lg:hidden" />

      <div className="space-y-2 lg:col-span-2">
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
        <div className="space-y-3 rounded-lg border p-3 lg:columns-2 lg:gap-x-10">
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
                  isSelected={(k) => !hidden.has(k)}
                  setSelected={setZmanVisible}
                  open={openBases.has(base)}
                  onToggleOpen={() => toggleBase(base)}
                  idPrefix="zman"
                />
              ))}
            </section>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{t('zmanimDisplayHint')}</p>
      </div>
      </div>
    </SettingsDialogShell>
  );
}
