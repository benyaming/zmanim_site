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
 * Validate a persisted hidden-zmanim preference. Visibility is stored as the
 * set of HIDDEN keys (not visible ones) so zmanim added in future releases
 * default to shown for existing users. Unknown or malformed entries are
 * dropped, which also heals a save from a version whose keys no longer exist.
 */
export function sanitizeHiddenZmanim(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((k): k is string => typeof k === 'string' && CONFIGURABLE_KEYS.has(k)))];
}
