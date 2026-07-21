import { newId, sanitizePersonalDates } from './sanitize';
import type { AnchorDate, Person, PersonalDatesData } from './types';

/**
 * Convert the legacy flat `customDates` list (single-kind entries anchored on a
 * Hebrew date) into the person-centric model. Each legacy entry becomes one
 * person:
 *   · birthday                 → a birth event (gender unset)
 *   · barMitzvah / batMitzvah  → a birth event (gender male / female); the
 *                                milestone re-derives from birth + gender
 *   · yahrzeit                 → a death event
 * The result is re-validated so caps, id dedup and bounds all apply.
 */

type LegacyKind = 'birthday' | 'barMitzvah' | 'batMitzvah' | 'yahrzeit';

interface LegacyCustomDate {
  id?: unknown;
  kind?: unknown;
  label?: unknown;
  hebrew?: unknown;
  afterSunset?: unknown;
  adarBehavior?: unknown;
}

const LEGACY_KINDS: readonly string[] = ['birthday', 'barMitzvah', 'batMitzvah', 'yahrzeit'];

export function migrateLegacyCustomDates(raw: unknown): PersonalDatesData {
  if (!Array.isArray(raw)) return { people: [], occasions: [] };
  const people: Person[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const legacy = item as LegacyCustomDate;
    const { id, kind, label } = legacy;
    if (typeof kind !== 'string' || !LEGACY_KINDS.includes(kind)) continue;

    // The anchor's validity is checked by the sanitizer below; pass it through.
    const anchor = {
      hebrew: legacy.hebrew,
      afterSunset: legacy.afterSunset,
      adarBehavior: legacy.adarBehavior,
    } as unknown as AnchorDate;

    const person = {
      id: typeof id === 'string' && id ? id : newId(),
      name: typeof label === 'string' ? label : '',
      gender: kind === 'barMitzvah' ? 'male' : kind === 'batMitzvah' ? 'female' : undefined,
      events: [
        {
          id: newId(),
          kind: (kind as LegacyKind) === 'yahrzeit' ? 'death' : 'birth',
          // bar/bat mitzvah always observe Adar II — drop any stored Adar choice
          // that only applied to the (now re-derived) milestone.
          anchor: kind === 'barMitzvah' || kind === 'batMitzvah' ? { ...anchor, adarBehavior: undefined } : anchor,
        },
      ],
    } as Person;
    people.push(person);
  }
  // Re-validate, then drop any person whose single migrated date failed
  // validation (a malformed legacy entry leaves an empty, useless person).
  const clean = sanitizePersonalDates({ people, occasions: [] });
  return { people: clean.people.filter((p) => p.events.length > 0), occasions: [] };
}
