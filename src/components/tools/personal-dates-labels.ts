import type { Observance, ObservanceKind } from '@/lib/personal-dates';

/** A next-intl translator bound to the `personalDates` namespace. */
export type PersonalDatesTranslator = (key: string, values?: Record<string, string | number>) => string;

/** Generic label for an observance whose owner has no name — used on the tight grid. */
const FALLBACK_KEY: Record<ObservanceKind, string> = {
  hebrewBirthday: 'kindBirthday',
  civilBirthday: 'kindBirthday',
  bris: 'kindBris',
  barMitzvah: 'kindBarMitzvah',
  batMitzvah: 'kindBatMitzvah',
  yahrzeit: 'kindYahrzeit',
  civilDeathAnniversary: 'kindYahrzeit',
  shiva: 'kindShiva',
  shloshim: 'kindShloshim',
  hebrewAnniversary: 'kindAnniversary',
  civilAnniversary: 'kindAnniversary',
};

/** The name to show for an observance, falling back to a generic kind label. */
export function observanceName(obs: Observance, t: PersonalDatesTranslator): string {
  return obs.label.trim() || t(FALLBACK_KEY[obs.kind]);
}

/**
 * Kinds that exist on both calendars (or whose Hebrew/civil twin does), so the
 * panel chip must say which calendar this particular day belongs to. The
 * inherently-Hebrew milestones (bris, bar/bat mitzvah, shiva, shloshim) carry
 * no tag — the term already implies the calendar.
 */
const TAGGED_KINDS = new Set<ObservanceKind>([
  'hebrewBirthday',
  'civilBirthday',
  'yahrzeit',
  'civilDeathAnniversary',
  'hebrewAnniversary',
  'civilAnniversary',
]);

/**
 * The full chip text for the day panel: name + qualifier, plus a calendar tag on
 * the both-calendar observances. Hebrew and civil variants share wording (they
 * fall on different days) and are told apart by the tag; the Hebrew yahrzeit and
 * the civil anniversary of a passing share wording too, distinguished the same way.
 */
export function observanceChipText(obs: Observance, t: PersonalDatesTranslator): string {
  const label = observanceName(obs, t);
  const n = obs.number ?? 0;
  const base = (() => {
    switch (obs.kind) {
      case 'hebrewBirthday':
      case 'civilBirthday':
        return n === 0 ? t('chipBorn', { label }) : t('chipBirthday', { label, age: n });
      case 'bris':
        return t('chipBris', { label });
      case 'barMitzvah':
        return t('chipBarMitzvah', { label });
      case 'batMitzvah':
        return t('chipBatMitzvah', { label });
      case 'yahrzeit':
      case 'civilDeathAnniversary':
        return n === 0 ? t('chipDied', { label }) : t('chipYahrzeit', { label, n });
      case 'shiva':
        return t('chipShiva', { label });
      case 'shloshim':
        return t('chipShloshim', { label });
      case 'hebrewAnniversary':
      case 'civilAnniversary':
        return n === 0 ? t('chipMarried', { label }) : t('chipAnniversary', { label, n });
    }
  })();
  // The origin day (born / married / passed away, number 0) falls on the same
  // day on both calendars, so it needs no tag; only its anniversaries do.
  if (!TAGGED_KINDS.has(obs.kind) || n === 0) return base;
  return `${base} · ${t(obs.calendar === 'hebrew' ? 'calHebrew' : 'calCivil')}`;
}
