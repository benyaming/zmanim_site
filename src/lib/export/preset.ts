/**
 * The zmanim-table export's remembered selection — its "last preset".
 *
 * Rebuilding a selection is the tool's biggest cost: twenty opinions, nine day
 * columns, the learning cycles, the report language. Remembering it turns a
 * recurring monthly export into two clicks. It rides the app prefs rather than a
 * key of its own, so settings sync carries it between devices for free (the sync
 * blob treats the prefs object as opaque — see docs/settings-sync.md).
 *
 * The date range is remembered as a LENGTH, never as two dates: someone who
 * printed a 31-day sheet in January wants another month in February, not January
 * again. The tool re-anchors the saved length on today.
 *
 * Everything here is read back from localStorage — and from whatever another
 * device pushed through sync — so `sanitizeExportPreset` treats all of it as
 * untrusted and drops anything it doesn't recognize. A stale zman key from an
 * older release therefore disappears instead of producing an empty column.
 */

import { routing } from '@/i18n/routing';
import { LEARNING_CYCLE_KEYS, type LearningCycleKey } from '@/lib/learning';
import { ZMANIM } from '@/lib/zmanim';

import { MAX_TABLE_DAYS } from './table';

/** The individually-removable day columns, by the tool's own names for them. */
export interface ExportPresetColumns {
  date: boolean;
  weekday: boolean;
  hebrewDate: boolean;
  holiday: boolean;
  parsha: boolean;
  candles: boolean;
  fasts: boolean;
  mevarchim: boolean;
  omer: boolean;
}

export interface ExportPreset {
  /** Days from the start date to the end date, inclusive (1 = a single day). */
  rangeDays: number;
  /** Selected zman keys. Empty is a real choice — day columns only. */
  keys: string[];
  learning: LearningCycleKey[];
  columns: ExportPresetColumns;
  transpose: boolean;
  /** Report language. Absent = follow the UI language, as a first export does. */
  reportLocale?: string;
  /** A saved-location id, or 'current' for whatever the app is showing. */
  locationId: string;
  useElevation: boolean;
  lehumra: boolean;
}

/** The column set a first-time export starts from: everything on. */
const ALL_COLUMNS: ExportPresetColumns = {
  date: true,
  weekday: true,
  hebrewDate: true,
  holiday: true,
  parsha: true,
  candles: true,
  fasts: true,
  mevarchim: true,
  omer: true,
};

export const COLUMN_KEYS = Object.keys(ALL_COLUMNS) as (keyof ExportPresetColumns)[];

/** The tool's default span: today plus the next 30 days. */
export const DEFAULT_EXPORT_RANGE_DAYS = 31;

const ZMAN_KEYS: ReadonlySet<string> = new Set(ZMANIM.map((z) => z.key));

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Parse an untrusted value into a preset, or null when there is nothing usable
 * in it. Null matters: the tool falls back to its live defaults (which depend on
 * the user's hidden-zman list) rather than to a frozen copy of them, so a device
 * with no saved preset still tracks the app default across releases.
 */
export function sanitizeExportPreset(raw: unknown): ExportPreset | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;

  // Keys and columns are the substance of a preset; a blob carrying neither is
  // noise (an empty object written by some older shape), not a choice.
  if (!Array.isArray(p.keys) && typeof p.columns !== 'object') return null;

  const rangeDays =
    typeof p.rangeDays === 'number' && Number.isFinite(p.rangeDays)
      ? Math.min(MAX_TABLE_DAYS, Math.max(1, Math.round(p.rangeDays)))
      : DEFAULT_EXPORT_RANGE_DAYS;

  const keys = Array.isArray(p.keys) ? [...new Set(p.keys.filter((k): k is string => ZMAN_KEYS.has(k as string)))] : [];

  const learning = Array.isArray(p.learning)
    ? LEARNING_CYCLE_KEYS.filter((k) => (p.learning as unknown[]).includes(k))
    : [];

  const saved = (typeof p.columns === 'object' && p.columns !== null ? p.columns : {}) as Record<string, unknown>;
  const columns = { ...ALL_COLUMNS };
  for (const key of COLUMN_KEYS) columns[key] = boolOr(saved[key], ALL_COLUMNS[key]);

  const reportLocale =
    typeof p.reportLocale === 'string' && (routing.locales as readonly string[]).includes(p.reportLocale)
      ? p.reportLocale
      : undefined;

  return {
    rangeDays,
    keys,
    learning,
    columns,
    transpose: boolOr(p.transpose, false),
    reportLocale,
    locationId: typeof p.locationId === 'string' && p.locationId ? p.locationId : 'current',
    useElevation: boolOr(p.useElevation, false),
    lehumra: boolOr(p.lehumra, false),
  };
}
