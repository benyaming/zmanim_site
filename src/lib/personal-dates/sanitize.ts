import { daysInJewishMonth, isHebrewLeapYear } from '@/lib/calendar';

import {
  type AnchorDate,
  type HebrewDateParts,
  MAX_EVENTS_PER_PERSON,
  MAX_OCCASIONS,
  MAX_PEOPLE,
  type MilestoneKey,
  type Person,
  type PersonalDatesData,
  type PersonEvent,
  type PersonEventKind,
  SINGLE_EVENT_KINDS,
  type StandaloneDate,
} from './types';

/**
 * kosher-zmanim throws for dates before 18 Teves 3761 (the Gregorian epoch),
 * so the sanitizer only accepts whole years from 3762 on. The upper bound just
 * keeps persisted garbage from constructing absurd dates.
 */
export const MIN_HEBREW_YEAR = 3762;
export const MAX_HEBREW_YEAR = 9999;

const EVENT_KINDS: readonly string[] = ['birth', 'death', 'wedding', 'custom'] satisfies PersonEventKind[];
const OCCASION_KINDS: readonly string[] = ['wedding', 'anniversary', 'custom'] satisfies StandaloneDate['kind'][];
const MILESTONE_KEYS: readonly MilestoneKey[] = ['bris', 'barMitzvah', 'batMitzvah'];

/**
 * Generate an id. `crypto.randomUUID` needs a secure context (it's undefined
 * over plain-HTTP LAN access, e.g. the dev server opened from a phone) and is
 * missing in older Safari — fall back to a timestamp + random suffix, plenty
 * for a per-device list.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Validate persisted Hebrew date parts arithmetically — month 13 only in leap
 * years, day within the month's real length — *before* anything reaches
 * kosher-zmanim, whose setters throw on impossible dates.
 */
function sanitizeHebrewParts(raw: unknown): HebrewDateParts | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { year, month, day } = raw as Partial<HebrewDateParts>;
  if (typeof year !== 'number' || !Number.isInteger(year) || year < MIN_HEBREW_YEAR || year > MAX_HEBREW_YEAR) return null;
  const monthsInYear = isHebrewLeapYear(year) ? 13 : 12;
  if (typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > monthsInYear) return null;
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > daysInJewishMonth(year, month)) return null;
  return { year, month, day };
}

function sanitizeAnchor(raw: unknown): AnchorDate | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { hebrew, afterSunset, adarBehavior } = raw as Partial<AnchorDate>;
  const parts = sanitizeHebrewParts(hebrew);
  if (!parts) return null;
  return {
    hebrew: parts,
    afterSunset: afterSunset === true ? true : undefined,
    adarBehavior: adarBehavior === 'adar1' || adarBehavior === 'adar2' ? adarBehavior : undefined,
  };
}

function sanitizeOverrides(raw: unknown): PersonEvent['overrides'] {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const source = raw as Record<string, unknown>;
  const out: NonNullable<PersonEvent['overrides']> = {};
  for (const key of MILESTONE_KEYS) {
    const value = source[key];
    if (value === 'off') out[key] = 'off';
    else {
      const anchor = sanitizeAnchor(value);
      if (anchor) out[key] = anchor;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeEvent(raw: unknown, seen: Set<string>): PersonEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, kind, anchor, burial, label, overrides } = raw as Partial<PersonEvent>;
  if (typeof kind !== 'string' || !EVENT_KINDS.includes(kind)) return null;
  const anchorParts = sanitizeAnchor(anchor);
  if (!anchorParts) return null;
  const evId = typeof id === 'string' && id && !seen.has(id) ? id : newId();
  seen.add(evId);
  const event: PersonEvent = { id: evId, kind: kind as PersonEventKind, anchor: anchorParts };
  if (kind === 'death') {
    const burialParts = sanitizeAnchor(burial);
    if (burialParts) event.burial = burialParts;
  }
  if (kind === 'custom' && typeof label === 'string') event.label = label;
  if (kind === 'birth') {
    const ov = sanitizeOverrides(overrides);
    if (ov) event.overrides = ov;
  }
  return event;
}

function sanitizePerson(raw: unknown, seen: Set<string>): Person | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, name, gender, events } = raw as Partial<Person>;
  if (typeof id !== 'string' || !id || seen.has(id)) return null;
  if (typeof name !== 'string') return null;
  const evSeen = new Set<string>();
  const seenSingle = new Set<PersonEventKind>();
  const outEvents: PersonEvent[] = [];
  if (Array.isArray(events)) {
    for (const e of events) {
      if (outEvents.length >= MAX_EVENTS_PER_PERSON) break;
      const event = sanitizeEvent(e, evSeen);
      if (!event) continue;
      // A person is born once and passes once — drop any duplicate birth/death.
      if (SINGLE_EVENT_KINDS.includes(event.kind)) {
        if (seenSingle.has(event.kind)) continue;
        seenSingle.add(event.kind);
      }
      outEvents.push(event);
    }
  }
  return { id, name, gender: gender === 'male' || gender === 'female' ? gender : undefined, events: outEvents };
}

function sanitizeOccasion(raw: unknown, seen: Set<string>): StandaloneDate | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, kind, label, anchor } = raw as Partial<StandaloneDate>;
  if (typeof id !== 'string' || !id || seen.has(id)) return null;
  if (typeof kind !== 'string' || !OCCASION_KINDS.includes(kind)) return null;
  if (typeof label !== 'string') return null;
  const anchorParts = sanitizeAnchor(anchor);
  if (!anchorParts) return null;
  return { id, kind: kind as StandaloneDate['kind'], label, anchor: anchorParts };
}

/** Validate the persisted tool state, dropping malformed pieces so old saves self-heal. */
export function sanitizePersonalDates(raw: unknown): PersonalDatesData {
  if (typeof raw !== 'object' || raw === null) return { people: [], occasions: [] };
  const { people, occasions } = raw as Partial<PersonalDatesData>;

  const peopleOut: Person[] = [];
  const peopleSeen = new Set<string>();
  if (Array.isArray(people)) {
    for (const p of people) {
      if (peopleOut.length >= MAX_PEOPLE) break;
      const person = sanitizePerson(p, peopleSeen);
      if (!person) continue;
      peopleSeen.add(person.id);
      peopleOut.push(person);
    }
  }

  const occasionsOut: StandaloneDate[] = [];
  const occasionsSeen = new Set<string>();
  if (Array.isArray(occasions)) {
    for (const o of occasions) {
      if (occasionsOut.length >= MAX_OCCASIONS) break;
      const occasion = sanitizeOccasion(o, occasionsSeen);
      if (!occasion) continue;
      occasionsSeen.add(occasion.id);
      occasionsOut.push(occasion);
    }
  }

  return { people: peopleOut, occasions: occasionsOut };
}
