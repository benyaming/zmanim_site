import type { DateTime } from 'luxon';

/**
 * Havdalah opinions, matching the companion `zmanim_bot` / `zmanim_api`
 * (key strings kept identical for parity). Each resolves to one of the tzeit
 * zmanim already in {@link ZMANIM}, so the times are the same validated values.
 */
export const HAVDALAH_OPINIONS = [
  'tzeis_5_95_degrees',
  'tzeis_8_5_degrees',
  'tzeis_42_minutes',
  'tzeis_72_minutes',
] as const;

export type HavdalahOpinion = (typeof HAVDALAH_OPINIONS)[number];

/** zmanim_bot's default opinion. */
export const DEFAULT_HAVDALAH_OPINION: HavdalahOpinion = 'tzeis_8_5_degrees';

/** The zman `key` (in {@link ZMANIM}) each opinion maps to. */
const OPINION_ZMAN_KEY: Record<HavdalahOpinion, string> = {
  tzeis_5_95_degrees: 'tzaisGeonim', // getTzaisGeonim5Point95Degrees
  tzeis_8_5_degrees: 'tzais', // getTzais (8.5°)
  tzeis_42_minutes: 'tzais42', // sunset + 42 min
  tzeis_72_minutes: 'tzais72', // getTzais72 (sunset + 72 min)
};

export function isHavdalahOpinion(value: unknown): value is HavdalahOpinion {
  return typeof value === 'string' && (HAVDALAH_OPINIONS as readonly string[]).includes(value);
}

/** The `zmanim.shitot` translation key for an opinion's badge/sub-label. */
export function havdalahZmanKey(opinion: HavdalahOpinion): string {
  return OPINION_ZMAN_KEY[opinion];
}

/** Resolve an opinion's havdalah time from a key→time map of computed zmanim. */
export function havdalahTime(opinion: HavdalahOpinion, byKey: Record<string, DateTime | null>): DateTime | null {
  return byKey[OPINION_ZMAN_KEY[opinion]] ?? null;
}
