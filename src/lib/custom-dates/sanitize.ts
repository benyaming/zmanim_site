import { daysInJewishMonth, isHebrewLeapYear } from '@/lib/calendar';

import { type CustomDate, type CustomDateKind, type HebrewDateParts, MAX_CUSTOM_DATES } from './types';

const KINDS: readonly string[] = ['birthday', 'barMitzvah', 'batMitzvah', 'yahrzeit'] satisfies CustomDateKind[];

/**
 * kosher-zmanim throws for dates before 18 Teves 3761 (the Gregorian epoch),
 * so the sanitizer only accepts whole years from 3762 on. The upper bound just
 * keeps persisted garbage from constructing absurd dates.
 */
export const MIN_HEBREW_YEAR = 3762;
export const MAX_HEBREW_YEAR = 9999;

/**
 * Generate an id for a new entry. `crypto.randomUUID` needs a secure context
 * (it's undefined over plain-HTTP LAN access, e.g. the dev server opened from
 * a phone) and is missing in older Safari — fall back to a timestamp + random
 * suffix, which is plenty for a per-device list.
 */
export function newCustomDateId(): string {
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

/** Validate persisted entries, dropping malformed ones so old saves self-heal. */
export function sanitizeCustomDates(raw: unknown): CustomDate[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CustomDate[] = [];
  for (const item of raw) {
    if (out.length >= MAX_CUSTOM_DATES) break;
    if (typeof item !== 'object' || item === null) continue;
    const { id, kind, label, hebrew, afterSunset, adarBehavior } = item as Partial<CustomDate>;
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    if (typeof kind !== 'string' || !KINDS.includes(kind)) continue;
    if (typeof label !== 'string') continue;
    const parts = sanitizeHebrewParts(hebrew);
    if (!parts) continue;
    seen.add(id);
    out.push({
      id,
      kind,
      label,
      hebrew: parts,
      afterSunset: afterSunset === true ? true : undefined,
      adarBehavior: adarBehavior === 'adar1' || adarBehavior === 'adar2' ? adarBehavior : undefined,
    });
  }
  return out;
}
