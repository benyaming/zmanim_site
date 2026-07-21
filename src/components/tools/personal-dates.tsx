'use client';

import { CalendarHeart, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { DateTime } from 'luxon';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { daysInJewishMonth, isHebrewLeapYear } from '@/lib/calendar';
import {
  type AdarBehavior,
  type AnchorDate,
  brisDay,
  civilOfAnchor,
  formatHebrewDateParts,
  type Gender,
  type HebrewDateParts,
  hebrewPartsToDay,
  MAX_EVENTS_PER_PERSON,
  MAX_OCCASIONS,
  MAX_PEOPLE,
  type MilestoneKey,
  mitzvahDay,
  nextCivilAnniversary,
  nextHebrewAnniversary,
  partsFromDay,
  type Person,
  type PersonEvent,
  type PersonEventKind,
  shivaDay,
  shloshimDay,
  SINGLE_EVENT_KINDS,
  type StandaloneDate,
} from '@/lib/personal-dates';

type Translator = (key: string, values?: Record<string, string | number>) => string;

const EVENT_KINDS: PersonEventKind[] = ['birth', 'death', 'wedding', 'custom'];
const OCCASION_KINDS: StandaloneDate['kind'][] = ['wedding', 'anniversary', 'custom'];
const MILESTONE_KEYS: readonly MilestoneKey[] = ['bris', 'barMitzvah', 'batMitzvah'];

const eventKindKey = (kind: PersonEventKind): string => `event${kind[0].toUpperCase()}${kind.slice(1)}`;
const occasionKindKey = (kind: StandaloneDate['kind']): string => `occasion${kind[0].toUpperCase()}${kind.slice(1)}`;

/** The Adar default for a Hebrew recurrence — death observes Adar I (Ashkenazi), the rest Adar II. */
const defaultAdarForEvent = (kind: PersonEventKind): AdarBehavior => (kind === 'death' ? 'adar1' : 'adar2');

/** Which milestones a person of this gender has. */
const milestonesFor = (gender: Gender | undefined): MilestoneKey[] =>
  gender === 'male' ? ['bris', 'barMitzvah'] : gender === 'female' ? ['batMitzvah'] : [];

/** The per-entry Adar choice only means anything for an Adar-of-a-regular-year anchor. */
const adarRelevant = (parts: HebrewDateParts): boolean => parts.month === 12 && !isHebrewLeapYear(parts.year);

/** Clamp a date's day/month into a target year (e.g. after changing year or month). */
function clampParts(parts: HebrewDateParts): HebrewDateParts {
  const maxMonth = isHebrewLeapYear(parts.year) ? 13 : 12;
  const month = Math.min(parts.month, maxMonth);
  const day = Math.min(parts.day, daysInJewishMonth(parts.year, month));
  return { year: parts.year, month, day };
}

const fmtDay = (dt: DateTime, locale: string): string => dt.setLocale(locale).toLocaleString(DateTime.DATE_MED);

/** A Hebrew · civil rendering of an anchor for list rows. */
const fmtAnchor = (anchor: AnchorDate, locale: string): string =>
  `${formatHebrewDateParts(anchor.hebrew, locale)} · ${fmtDay(civilOfAnchor(anchor), locale)}`;

// ── Anchor form state ───────────────────────────────────────────────────────

/** The editable form of an {@link AnchorDate}; the canonical Hebrew date is the source of truth. */
interface AnchorState {
  hebrew: HebrewDateParts;
  afterSunset: boolean;
  mode: 'gregorian' | 'hebrew';
  adarBehavior?: AdarBehavior;
}

const newAnchorState = (today: DateTime): AnchorState => ({
  hebrew: partsFromDay(today),
  afterSunset: false,
  mode: 'gregorian',
});

const anchorStateFrom = (anchor: AnchorDate): AnchorState => ({
  hebrew: anchor.hebrew,
  afterSunset: anchor.afterSunset ?? false,
  mode: anchor.afterSunset ? 'gregorian' : 'hebrew',
  adarBehavior: anchor.adarBehavior,
});

const anchorStateToDate = (state: AnchorState, defaultAdar: AdarBehavior): AnchorDate => ({
  hebrew: state.hebrew,
  afterSunset: state.afterSunset ? true : undefined,
  adarBehavior: adarRelevant(state.hebrew) ? (state.adarBehavior ?? defaultAdar) : undefined,
});

/** The shared civil/Hebrew date sub-form. Fully controlled; its truth is the Hebrew date. */
function AnchorDateField({
  value,
  onChange,
  defaultAdar,
  allowAdar = true,
  t,
  locale,
}: {
  value: AnchorState;
  onChange: (next: AnchorState) => void;
  defaultAdar: AdarBehavior;
  allowAdar?: boolean;
  t: Translator;
  locale: string;
}) {
  const { hebrew, afterSunset, mode } = value;
  const gregorianDay = hebrewPartsToDay(hebrew).minus({ days: afterSunset ? 1 : 0 });
  const setHebrew = (next: HebrewDateParts) => onChange({ ...value, hebrew: clampParts(next) });

  const onGregorianChange = (iso: string) => {
    const dt = DateTime.fromISO(iso);
    if (dt.isValid) setHebrew(partsFromDay(dt.plus({ days: afterSunset ? 1 : 0 })));
  };
  // The Hebrew picker's cell IS the Hebrew day — no sunset offset applies.
  const onHebrewChange = (iso: string) => {
    const dt = DateTime.fromISO(iso);
    if (dt.isValid) setHebrew(partsFromDay(dt));
  };
  const onAfterSunsetChange = (next: boolean) => {
    // Keep the displayed civil date fixed; move the canonical Hebrew day instead.
    const civil = hebrewPartsToDay(hebrew).minus({ days: afterSunset ? 1 : 0 });
    onChange({ ...value, afterSunset: next, hebrew: partsFromDay(civil.plus({ days: next ? 1 : 0 })) });
  };

  return (
    <div className="space-y-2">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && onChange({ ...value, mode: v as AnchorState['mode'] })}
        className="w-full"
      >
        <ToggleGroupItem value="gregorian" className="flex-1">
          {t('modeGregorian')}
        </ToggleGroupItem>
        <ToggleGroupItem value="hebrew" className="flex-1">
          {t('modeHebrew')}
        </ToggleGroupItem>
      </ToggleGroup>

      {mode === 'gregorian' ? (
        <>
          <DatePicker
            value={gregorianDay.toISODate() ?? undefined}
            onChange={onGregorianChange}
            placeholder={t('dateLabel')}
            aria-label={t('dateLabel')}
          />
          <label className="flex items-start gap-2">
            <Checkbox checked={afterSunset} onCheckedChange={(c) => onAfterSunsetChange(c === true)} className="mt-0.5" />
            <span className="text-sm">
              {t('afterSunset')}
              <span className="text-muted-foreground block text-xs">{t('afterSunsetHint')}</span>
            </span>
          </label>
        </>
      ) : (
        <DatePicker
          mode="hebrew"
          value={hebrewPartsToDay(hebrew).toISODate() ?? undefined}
          onChange={onHebrewChange}
          placeholder={t('modeHebrew')}
          aria-label={t('modeHebrew')}
        />
      )}

      {allowAdar && adarRelevant(hebrew) && (
        <label className="block">
          <span className="text-muted-foreground mb-1 block text-xs font-medium">{t('adarLabel')}</span>
          <Select
            value={value.adarBehavior ?? defaultAdar}
            onValueChange={(v) => onChange({ ...value, adarBehavior: v as AdarBehavior })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adar1">{t('adarI')}</SelectItem>
              <SelectItem value="adar2">{t('adarII')}</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground mt-1 block text-xs">{t('adarHint')}</span>
        </label>
      )}

      <p className="text-muted-foreground text-xs">
        {t('preview', { hebrew: formatHebrewDateParts(hebrew, locale), gregorian: fmtDay(gregorianDay, locale) })}
      </p>
    </div>
  );
}

// ── Event form ──────────────────────────────────────────────────────────────

interface MilestoneState {
  show: boolean;
  custom?: AnchorState;
}

interface EventFormState {
  kind: PersonEventKind;
  anchor: AnchorState;
  label: string;
  hasBurial: boolean;
  burial: AnchorState;
  milestones: Record<MilestoneKey, MilestoneState>;
}

const newMilestones = (): Record<MilestoneKey, MilestoneState> => ({
  bris: { show: true },
  barMitzvah: { show: true },
  batMitzvah: { show: true },
});

function eventFormFrom(event: PersonEvent | null, today: DateTime, defaultKind: PersonEventKind = 'birth'): EventFormState {
  const milestones = newMilestones();
  if (event?.overrides) {
    for (const key of MILESTONE_KEYS) {
      const ov = event.overrides[key];
      if (ov === 'off') milestones[key] = { show: false };
      else if (ov) milestones[key] = { show: true, custom: anchorStateFrom(ov) };
    }
  }
  return {
    kind: event?.kind ?? defaultKind,
    anchor: event ? anchorStateFrom(event.anchor) : newAnchorState(today),
    label: event?.label ?? '',
    hasBurial: Boolean(event?.burial),
    burial: event?.burial ? anchorStateFrom(event.burial) : newAnchorState(today),
    milestones,
  };
}

function buildEvent(state: EventFormState): Omit<PersonEvent, 'id'> {
  const event: Omit<PersonEvent, 'id'> = {
    kind: state.kind,
    anchor: anchorStateToDate(state.anchor, defaultAdarForEvent(state.kind)),
  };
  if (state.kind === 'death' && state.hasBurial) event.burial = anchorStateToDate(state.burial, 'adar1');
  if (state.kind === 'custom' && state.label.trim()) event.label = state.label.trim();
  if (state.kind === 'birth') {
    const overrides: NonNullable<PersonEvent['overrides']> = {};
    for (const key of MILESTONE_KEYS) {
      const m = state.milestones[key];
      if (!m.show) overrides[key] = 'off';
      else if (m.custom) overrides[key] = anchorStateToDate(m.custom, 'adar2');
    }
    if (Object.keys(overrides).length > 0) event.overrides = overrides;
  }
  return event;
}

function MilestoneRow({
  keyName,
  state,
  onChange,
  t,
  locale,
}: {
  keyName: MilestoneKey;
  state: MilestoneState;
  onChange: (next: MilestoneState) => void;
  t: Translator;
  locale: string;
}) {
  const label = t(`milestone${keyName[0].toUpperCase()}${keyName.slice(1)}`);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={state.show} onCheckedChange={(c) => onChange({ ...state, show: c === true })} />
          {label}
        </label>
        {state.show && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-6 px-2 text-xs"
            onClick={() => onChange({ ...state, custom: state.custom ? undefined : newAnchorState(DateTime.now()) })}
          >
            {state.custom ? t('milestoneAuto') : t('milestoneAdjust')}
          </Button>
        )}
      </div>
      {state.show && state.custom && (
        <div className="border-s ps-3">
          <AnchorDateField
            value={state.custom}
            onChange={(v) => onChange({ ...state, custom: v })}
            defaultAdar="adar2"
            allowAdar={false}
            t={t}
            locale={locale}
          />
        </div>
      )}
    </div>
  );
}

function PersonEventForm({
  initial,
  gender,
  disabledKinds,
  onSubmit,
  onCancel,
  t,
  locale,
}: {
  initial: EventFormState;
  gender: Gender | undefined;
  /** Singleton kinds (birth/death) already used by the person's other events. */
  disabledKinds: PersonEventKind[];
  onSubmit: (event: Omit<PersonEvent, 'id'>) => void;
  onCancel: () => void;
  t: Translator;
  locale: string;
}) {
  const [state, setState] = useState<EventFormState>(initial);
  const milestones = milestonesFor(gender);
  const kindOptions = EVENT_KINDS.filter((k) => !disabledKinds.includes(k));

  return (
    <form
      className="bg-muted/40 mt-1.5 space-y-3 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(buildEvent(state));
      }}
    >
      <label className="block">
        <span className="text-muted-foreground mb-1 block text-xs font-medium">{t('eventTypeLabel')}</span>
        <Select value={state.kind} onValueChange={(v) => setState((s) => ({ ...s, kind: v as PersonEventKind }))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kindOptions.map((k) => (
              <SelectItem key={k} value={k}>
                {t(eventKindKey(k))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      {state.kind === 'custom' && (
        <label className="block">
          <span className="text-muted-foreground mb-1 block text-xs font-medium">{t('customEventLabel')}</span>
          <Input
            value={state.label}
            onChange={(e) => setState((s) => ({ ...s, label: e.target.value }))}
            placeholder={t('customEventPlaceholder')}
            maxLength={60}
          />
        </label>
      )}

      <AnchorDateField
        value={state.anchor}
        onChange={(anchor) => setState((s) => ({ ...s, anchor }))}
        defaultAdar={defaultAdarForEvent(state.kind)}
        t={t}
        locale={locale}
      />

      {state.kind === 'death' && (
        <div className="space-y-2">
          <label className="flex items-start gap-2">
            <Checkbox
              checked={state.hasBurial}
              onCheckedChange={(c) => setState((s) => ({ ...s, hasBurial: c === true }))}
              className="mt-0.5"
            />
            <span className="text-sm">
              {t('burialToggle')}
              <span className="text-muted-foreground block text-xs">{t('burialHint')}</span>
            </span>
          </label>
          {state.hasBurial && (
            <div className="border-s ps-3">
              <AnchorDateField
                value={state.burial}
                onChange={(burial) => setState((s) => ({ ...s, burial }))}
                defaultAdar="adar1"
                t={t}
                locale={locale}
              />
            </div>
          )}
        </div>
      )}

      {state.kind === 'birth' && milestones.length > 0 && (
        <div className="space-y-2">
          <span className="text-muted-foreground block text-xs font-medium">{t('milestonesTitle')}</span>
          {milestones.map((key) => (
            <MilestoneRow
              key={key}
              keyName={key}
              state={state.milestones[key]}
              onChange={(m) => setState((s) => ({ ...s, milestones: { ...s.milestones, [key]: m } }))}
              t={t}
              locale={locale}
            />
          ))}
        </div>
      )}
      {state.kind === 'birth' && milestones.length === 0 && (
        <p className="text-muted-foreground text-xs">{t('milestonesNeedGender')}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" size="sm">
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

/** The derived-observance summary lines shown under an event row. */
function eventSummary(
  event: PersonEvent,
  gender: Gender | undefined,
  deathDay: DateTime | null,
  today: DateTime,
  locale: string,
  t: Translator,
): string[] {
  const out: string[] = [];
  const inLifetime = (day: DateTime): boolean => !deathDay || day <= deathDay;
  if (event.kind === 'birth') {
    // A birthday only recurs while the person is living.
    if (!deathDay) {
      const next = soonest(nextHebrewAnniversary(event.anchor, today, 'from0'), nextCivilAnniversary(event.anchor, today, 0));
      if (next) out.push(t('nextBirthday', { date: fmtDay(next, locale) }));
    }
    const brisOv = event.overrides?.bris;
    const barOv = event.overrides?.barMitzvah;
    const batOv = event.overrides?.batMitzvah;
    if (gender === 'male') {
      if (brisOv !== 'off') {
        const day = brisOv ? hebrewPartsToDay(brisOv.hebrew) : brisDay(event.anchor);
        if (inLifetime(day)) out.push(t('summaryBris', { date: fmtDay(day, locale) }));
      }
      if (barOv !== 'off') {
        const day = barOv ? hebrewPartsToDay(barOv.hebrew) : mitzvahDay(event.anchor, 'male');
        if (day && inLifetime(day)) out.push(t('summaryBarMitzvah', { date: fmtDay(day, locale) }));
      }
    } else if (gender === 'female' && batOv !== 'off') {
      const day = batOv ? hebrewPartsToDay(batOv.hebrew) : mitzvahDay(event.anchor, 'female');
      if (day && inLifetime(day)) out.push(t('summaryBatMitzvah', { date: fmtDay(day, locale) }));
    }
  } else if (event.kind === 'death') {
    // The yahrzeit is specifically the Hebrew observance — never the civil anniversary.
    const next = nextHebrewAnniversary(event.anchor, today, 'from1');
    if (next) out.push(t('nextYahrzeit', { date: fmtDay(next, locale) }));
    const burial = event.burial ?? event.anchor;
    out.push(t('summaryShiva', { date: fmtDay(shivaDay(burial), locale) }));
    out.push(t('summaryShloshim', { date: fmtDay(shloshimDay(burial), locale) }));
  } else {
    const next = soonest(nextHebrewAnniversary(event.anchor, today, 'from0'), nextCivilAnniversary(event.anchor, today, 0));
    if (next) out.push(t('nextAnniversary', { date: fmtDay(next, locale) }));
  }
  return out;
}

const soonest = (a: DateTime | null, b: DateTime | null): DateTime | null =>
  a && b ? (a <= b ? a : b) : (a ?? b);

// ── Person & occasion rows ──────────────────────────────────────────────────

function PersonCard({ person, t, locale }: { person: Person; t: Translator; locale: string }) {
  const { updatePerson, removePerson, addPersonEvent, updatePersonEvent, removePersonEvent } = useAppState();
  const today = DateTime.now();
  const [editingHeader, setEditingHeader] = useState(false);
  const [eventEditing, setEventEditing] = useState<string | 'new' | null>(null);
  const atEventLimit = person.events.length >= MAX_EVENTS_PER_PERSON;
  const deathDay = person.events.reduce<DateTime | null>((acc, ev) => {
    if (ev.kind !== 'death') return acc;
    const day = civilOfAnchor(ev.anchor);
    return !acc || day < acc ? day : acc;
  }, null);
  // Singleton kinds (birth/death) already used, so the form can't offer them again.
  const takenKinds = (exceptId?: string): PersonEventKind[] =>
    person.events.filter((e) => e.id !== exceptId && SINGLE_EVENT_KINDS.includes(e.kind)).map((e) => e.kind);
  const addDisabled = takenKinds();
  const addDefaultKind = EVENT_KINDS.find((k) => !addDisabled.includes(k)) ?? 'custom';

  const eventLabel = (event: PersonEvent): string =>
    event.kind === 'custom' && event.label ? event.label : t(eventKindKey(event.kind));

  return (
    <li className="rounded-lg border">
      <div className="flex items-center gap-0.5 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{person.name.trim() || t('unnamedPerson')}</span>
          {person.gender && (
            <Badge variant="secondary" className="shrink-0">
              {t(person.gender === 'male' ? 'genderMale' : 'genderFemale')}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-7 shrink-0"
          aria-label={t('edit')}
          onClick={() => setEditingHeader((v) => !v)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive size-7 shrink-0"
          aria-label={t('delete')}
          onClick={() => removePerson(person.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {editingHeader && (
        <div className="border-t px-2 py-2">
          <PersonFields
            name={person.name}
            gender={person.gender}
            onChange={(patch) => updatePerson(person.id, patch)}
            t={t}
          />
        </div>
      )}

      <ul className="space-y-1 px-2 pb-1.5">
        {person.events.map((event) =>
          eventEditing === event.id ? (
            <li key={event.id}>
              <PersonEventForm
                initial={eventFormFrom(event, today)}
                gender={person.gender}
                disabledKinds={takenKinds(event.id)}
                onSubmit={(patch) => {
                  updatePersonEvent(person.id, event.id, patch);
                  setEventEditing(null);
                }}
                onCancel={() => setEventEditing(null)}
                t={t}
                locale={locale}
              />
            </li>
          ) : (
            <li key={event.id} className="flex items-start gap-0.5">
              <div className="flex min-w-0 flex-1 flex-col py-1">
                <span className="truncate text-xs font-medium">{eventLabel(event)}</span>
                <span className="text-muted-foreground truncate text-xs">{fmtAnchor(event.anchor, locale)}</span>
                {eventSummary(event, person.gender, deathDay, today, locale, t).map((line, i) => (
                  <span key={i} className="text-muted-foreground truncate text-xs">
                    {line}
                  </span>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground size-6 shrink-0"
                aria-label={t('edit')}
                onClick={() => setEventEditing(event.id)}
              >
                <Pencil className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive size-6 shrink-0"
                aria-label={t('delete')}
                onClick={() => removePersonEvent(person.id, event.id)}
              >
                <Trash2 className="size-3" />
              </Button>
            </li>
          ),
        )}

        {eventEditing === 'new' ? (
          <li>
            <PersonEventForm
              initial={eventFormFrom(null, today, addDefaultKind)}
              gender={person.gender}
              disabledKinds={addDisabled}
              onSubmit={(event) => {
                addPersonEvent(person.id, event);
                setEventEditing(null);
              }}
              onCancel={() => setEventEditing(null)}
              t={t}
              locale={locale}
            />
          </li>
        ) : (
          <li>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-7 w-full justify-start gap-2 px-1"
              onClick={() => setEventEditing('new')}
              disabled={atEventLimit}
            >
              <Plus className="size-3.5" />
              {t('addEvent')}
            </Button>
          </li>
        )}
      </ul>
    </li>
  );
}

/** Name + gender fields, shared by add-person and the person header editor. */
function PersonFields({
  name,
  gender,
  onChange,
  t,
}: {
  name: string;
  gender: Gender | undefined;
  onChange: (patch: { name?: string; gender?: Gender }) => void;
  t: Translator;
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-muted-foreground mb-1 block text-xs font-medium">{t('personNameLabel')}</span>
        <Input
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t('personNamePlaceholder')}
          maxLength={60}
        />
      </label>
      <label className="block">
        <span className="text-muted-foreground mb-1 block text-xs font-medium">{t('genderLabel')}</span>
        <Select
          value={gender ?? 'unset'}
          onValueChange={(v) => onChange({ gender: v === 'unset' ? undefined : (v as Gender) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unset">{t('genderUnset')}</SelectItem>
            <SelectItem value="male">{t('genderMale')}</SelectItem>
            <SelectItem value="female">{t('genderFemale')}</SelectItem>
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}

function AddPersonForm({ onSubmit, onCancel, t }: { onSubmit: (input: { name: string; gender?: Gender }) => void; onCancel: () => void; t: Translator }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | undefined>(undefined);
  return (
    <form
      className="bg-muted/40 space-y-3 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name: name.trim(), gender });
      }}
    >
      <PersonFields
        name={name}
        gender={gender}
        onChange={(patch) => {
          if (patch.name !== undefined) setName(patch.name);
          if ('gender' in patch) setGender(patch.gender);
        }}
        t={t}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" size="sm">
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

function OccasionForm({
  initial,
  onSubmit,
  onCancel,
  t,
  locale,
}: {
  initial: { kind: StandaloneDate['kind']; label: string; anchor: AnchorState };
  onSubmit: (occasion: Omit<StandaloneDate, 'id'>) => void;
  onCancel: () => void;
  t: Translator;
  locale: string;
}) {
  const [kind, setKind] = useState(initial.kind);
  const [label, setLabel] = useState(initial.label);
  const [anchor, setAnchor] = useState(initial.anchor);

  return (
    <form
      className="bg-muted/40 mt-1.5 space-y-3 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ kind, label: label.trim(), anchor: anchorStateToDate(anchor, 'adar2') });
      }}
    >
      <label className="block">
        <span className="text-muted-foreground mb-1 block text-xs font-medium">{t('occasionTypeLabel')}</span>
        <Select value={kind} onValueChange={(v) => setKind(v as StandaloneDate['kind'])}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OCCASION_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {t(occasionKindKey(k))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="block">
        <span className="text-muted-foreground mb-1 block text-xs font-medium">{t('occasionLabel')}</span>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('occasionPlaceholder')} maxLength={60} />
      </label>
      <AnchorDateField value={anchor} onChange={setAnchor} defaultAdar="adar2" t={t} locale={locale} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" size="sm">
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

function OccasionRow({ occasion, t, locale }: { occasion: StandaloneDate; t: Translator; locale: string }) {
  const { updateOccasion, removeOccasion } = useAppState();
  const today = DateTime.now();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <OccasionForm
          initial={{ kind: occasion.kind, label: occasion.label, anchor: anchorStateFrom(occasion.anchor) }}
          onSubmit={(patch) => {
            updateOccasion(occasion.id, patch);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          t={t}
          locale={locale}
        />
      </li>
    );
  }

  const next = soonest(nextHebrewAnniversary(occasion.anchor, today, 'from0'), nextCivilAnniversary(occasion.anchor, today, 0));
  return (
    <li className="flex items-center gap-0.5">
      <div className="flex min-w-0 flex-1 flex-col px-2 py-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{occasion.label.trim() || t(occasionKindKey(occasion.kind))}</span>
          <Badge variant="secondary" className="shrink-0">
            {t(occasionKindKey(occasion.kind))}
          </Badge>
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {fmtAnchor(occasion.anchor, locale)}
          {next ? ` · ${t('nextAnniversary', { date: fmtDay(next, locale) })}` : ''}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground size-7 shrink-0"
        aria-label={t('edit')}
        onClick={() => setEditing(true)}
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive size-7 shrink-0"
        aria-label={t('delete')}
        onClick={() => removeOccasion(occasion.id)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}

// ── Top-level tool ──────────────────────────────────────────────────────────

export function PersonalDatesTool() {
  const t = useTranslations('personalDates');
  const locale = useLocale();
  const { personalDates, addPerson, addOccasion } = useAppState();
  const { people, occasions } = personalDates;
  const [addingPerson, setAddingPerson] = useState(false);
  const [addingOccasion, setAddingOccasion] = useState(false);

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          <CalendarHeart className="text-muted-foreground size-4" />
          <h3 className="text-sm font-semibold">{t('peopleTitle')}</h3>
        </div>
        {people.length === 0 && !addingPerson && <p className="text-muted-foreground text-sm">{t('peopleEmpty')}</p>}
        <ul className="space-y-1.5">
          {people.map((person) => (
            <PersonCard key={person.id} person={person} t={t} locale={locale} />
          ))}
        </ul>
        {addingPerson ? (
          <AddPersonForm
            onSubmit={(input) => {
              addPerson(input);
              setAddingPerson(false);
            }}
            onCancel={() => setAddingPerson(false)}
            t={t}
          />
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground w-full justify-start gap-2 px-2"
              onClick={() => setAddingPerson(true)}
              disabled={people.length >= MAX_PEOPLE}
            >
              <Plus className="size-4" />
              {t('addPerson')}
            </Button>
            {people.length >= MAX_PEOPLE && <p className="text-muted-foreground px-2 text-xs">{t('limitPeople', { max: MAX_PEOPLE })}</p>}
          </>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          <ChevronDown className="text-muted-foreground size-4" />
          <h3 className="text-sm font-semibold">{t('occasionsTitle')}</h3>
        </div>
        {occasions.length === 0 && !addingOccasion && <p className="text-muted-foreground text-sm">{t('occasionsEmpty')}</p>}
        <ul className="space-y-0.5">
          {occasions.map((occasion) => (
            <OccasionRow key={occasion.id} occasion={occasion} t={t} locale={locale} />
          ))}
        </ul>
        {addingOccasion ? (
          <OccasionForm
            initial={{ kind: 'wedding', label: '', anchor: newAnchorState(DateTime.now()) }}
            onSubmit={(occasion) => {
              addOccasion(occasion);
              setAddingOccasion(false);
            }}
            onCancel={() => setAddingOccasion(false)}
            t={t}
            locale={locale}
          />
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground w-full justify-start gap-2 px-2"
              onClick={() => setAddingOccasion(true)}
              disabled={occasions.length >= MAX_OCCASIONS}
            >
              <Plus className="size-4" />
              {t('addOccasion')}
            </Button>
            {occasions.length >= MAX_OCCASIONS && <p className="text-muted-foreground px-2 text-xs">{t('limitOccasions', { max: MAX_OCCASIONS })}</p>}
          </>
        )}
      </section>
    </div>
  );
}
