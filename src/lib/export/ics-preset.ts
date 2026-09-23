/**
 * The calendar (.ics) export's remembered selection and its limits.
 *
 * Kept apart from the event builder and the serializer on purpose: app state
 * imports this module eagerly (to load and persist the preset), while the tool
 * and its generation code load only when the tool is opened. Nothing here may
 * import `calendar-events.ts` or `ics.ts`, or the lazy chunk would leak into
 * the main bundle.
 *
 * Like the table export's preset (see preset.ts) this is read back from
 * localStorage and from whatever another device pushed through settings sync,
 * so `sanitizeIcsExportPreset` treats all of it as untrusted. Two things differ
 * by design:
 *
 * - Rounding and elevation are NOT remembered. The tool seeds both from the
 *   app settings on every open, so the app setting stays the single source and
 *   a one-off override never lingers.
 * - An absent field and an explicitly empty one mean different things. Absent
 *   means "use the tool's default"; `[]` means the user chose none, and stays
 *   none — sanitizing never turns an emptied selection back into all-on.
 */

import { routing } from '@/i18n/routing';
import { OBSERVANCE_KINDS, type ObservanceKind } from '@/lib/personal-dates';
import { CONFIGURABLE_ZMANIM } from '@/lib/zmanim';

import { MAX_TABLE_DAYS } from './table';

/** The event categories the tool offers, each one checkbox. */
export const ICS_CATEGORIES = ['candles', 'fasts', 'holidays', 'parsha'] as const;
export type IcsCategory = (typeof ICS_CATEGORIES)[number];

/** A first export includes every category. */
export const DEFAULT_ICS_CATEGORIES: Readonly<Record<IcsCategory, boolean>> = {
  candles: true,
  fasts: true,
  holidays: true,
  parsha: true,
};

/**
 * At most this many daily zmanim. Each adds an event on every day of the range,
 * which is what buries a user's own calendar; candles, fasts, holidays and
 * personal dates don't count against it.
 */
export const MAX_ICS_DAILY_ZMANIM = 6;

/** The longest range one file may cover — the table export's cap. */
export const MAX_ICS_DAYS = MAX_TABLE_DAYS;

/**
 * The zman keys a daily-zman event may use: the configurable zmanim minus the
 * shaah-zmanis durations, which are lengths of time, not moments.
 * `candleLighting` and the Erev-Pesach-only deadlines are already outside
 * CONFIGURABLE_ZMANIM. In definition order, which is chronological.
 */
export const ICS_DAILY_ZMAN_KEYS: readonly string[] = CONFIGURABLE_ZMANIM.filter((z) => !z.duration).map((z) => z.key);

const DAILY_KEY_SET = new Set(ICS_DAILY_ZMAN_KEYS);

export interface IcsExportPreset {
  /** Days from the start date to the end date, inclusive. Re-anchored on the 1st of the current month. */
  rangeDays?: number;
  /** Absent entries use the default (on). */
  categories?: Partial<Record<IcsCategory, boolean>>;
  /** Selected daily zmanim. Absent = none. */
  zmanKeys?: string[];
  /** The "Include personal dates" switch. Absent = the default (on). */
  personal?: boolean;
  /** Selected observance kinds. Absent = every kind; `[]` = none. */
  personalKinds?: ObservanceKind[];
  /** A saved-location id, or 'current'. */
  locationId?: string;
  /** Report language. Absent = follow the UI language. */
  reportLocale?: string;
}

/**
 * Daily-zman keys as the tool may use them: unknown, duration and duplicate
 * keys dropped, put in definition order, then capped. Validating before the
 * cap keeps a stale key from an older release from using up a slot.
 */
export function sanitizeIcsZmanKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const wanted = new Set(value.filter((k): k is string => typeof k === 'string' && DAILY_KEY_SET.has(k)));
  return ICS_DAILY_ZMAN_KEYS.filter((k) => wanted.has(k)).slice(0, MAX_ICS_DAILY_ZMANIM);
}

/** Observance kinds, deduplicated and in the panel's order; unknown kinds dropped. */
export function sanitizeObservanceKinds(value: unknown): ObservanceKind[] {
  if (!Array.isArray(value)) return [];
  const wanted = new Set(value);
  return OBSERVANCE_KINDS.filter((k) => wanted.has(k));
}

/** Validate a stored preset. Returns null when there is nothing usable to restore. */
export function sanitizeIcsExportPreset(value: unknown): IcsExportPreset | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  const out: IcsExportPreset = {};

  if (typeof p.rangeDays === 'number' && Number.isInteger(p.rangeDays) && p.rangeDays >= 1 && p.rangeDays <= MAX_ICS_DAYS) {
    out.rangeDays = p.rangeDays;
  }
  if (p.categories && typeof p.categories === 'object' && !Array.isArray(p.categories)) {
    const raw = p.categories as Record<string, unknown>;
    const categories: Partial<Record<IcsCategory, boolean>> = {};
    for (const key of ICS_CATEGORIES) if (typeof raw[key] === 'boolean') categories[key] = raw[key];
    if (Object.keys(categories).length > 0) out.categories = categories;
  }
  if (Array.isArray(p.zmanKeys)) out.zmanKeys = sanitizeIcsZmanKeys(p.zmanKeys);
  if (typeof p.personal === 'boolean') out.personal = p.personal;
  if (Array.isArray(p.personalKinds)) out.personalKinds = sanitizeObservanceKinds(p.personalKinds);
  if (typeof p.locationId === 'string' && p.locationId.length > 0 && p.locationId.length <= 200) out.locationId = p.locationId;
  if (typeof p.reportLocale === 'string' && (routing.locales as readonly string[]).includes(p.reportLocale)) {
    out.reportLocale = p.reportLocale;
  }

  return Object.keys(out).length > 0 ? out : null;
}
