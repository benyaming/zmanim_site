import { ZMANIM } from './definitions';
import type { ZmanDefinition } from './types';

/**
 * The zmanim a user can show/hide in the day panel. Candle lighting is excluded:
 * it renders in the events strip (not the zmanim list) and is governed by its
 * own offset setting, so hiding it here would have no visible effect. The Erev
 * Pesach chametz deadlines are excluded too — they appear one day a year, so a
 * year-round visibility toggle would be noise.
 */
export const CONFIGURABLE_ZMANIM: readonly ZmanDefinition[] = ZMANIM.filter(
  (z) => z.key !== 'candleLighting' && !z.erevPesachOnly,
);

const CONFIGURABLE_KEYS = new Set(CONFIGURABLE_ZMANIM.map((z) => z.key));

/**
 * The zmanim shown out of the box — the common everyday set, one shita per
 * zman: alot 16.1°, misheyakir 10.2°, Shma/Tfila by the Vilna Gaon, tzeit
 * 8.5°. Everything else starts hidden; a note under the day panel's list
 * points users to the settings picker to turn more on.
 */
const DEFAULT_VISIBLE_KEYS = new Set([
  'alosHashachar',
  'misheyakir102',
  'sunrise',
  'sofZmanShmaGRA',
  'sofZmanTfilaGRA',
  'chatzos',
  'minchaGedola',
  'minchaKetana',
  'plagHamincha',
  'sunset',
  'tzais',
]);

/**
 * The default hidden set, derived as the complement of DEFAULT_VISIBLE_KEYS so
 * visibility state keeps its hide-list convention (see sanitizeHiddenZmanim).
 */
export const DEFAULT_HIDDEN_ZMANIM: readonly string[] = CONFIGURABLE_ZMANIM.filter(
  (z) => !DEFAULT_VISIBLE_KEYS.has(z.key),
).map((z) => z.key);

/**
 * Validate a persisted hidden-zmanim preference. Visibility is stored as the
 * set of HIDDEN keys (not visible ones) so zmanim added in future releases
 * default to shown for existing users. Unknown or malformed entries are
 * dropped, which also heals a save from a version whose keys no longer exist.
 */
export function sanitizeHiddenZmanim(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((k): k is string => typeof k === 'string' && CONFIGURABLE_KEYS.has(k)))];
}
