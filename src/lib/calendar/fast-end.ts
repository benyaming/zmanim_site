/**
 * End-of-fast opinions. A fast ends at tzeit ha-kochavim; the question is WHICH
 * tzeit, and it differs by the fast's severity:
 *
 * - `gmarTaanis` — the end of a MINOR rabbinic fast (17 Tammuz, 10 Tevet, Tzom
 *   Gedaliah, Taanit Esther): the emergence of three MEDIUM stars, per myzmanim's
 *   "gmar hataaniyos." Degree-based and attributed to the poskim myzmanim's
 *   calculator uses — Baal HaTanya (5.95°), R' Tukachinsky (6.45°), R' Moshe
 *   Feinstein (7.083°) — each matching myzmanim to the second at Rosh HaAyin.
 * - `nightfall` — three SMALL stars, full nightfall. The stringent end, and the
 *   ONLY valid end for TISHA B'AV (a major fast). Minor fasts offer it too, for
 *   those who are stringent. `tzais` 8.5°, plus 42 min and Rabbeinu Tam 72 min.
 *
 * So a minor fast offers both groups; Tisha b'Av offers only `nightfall`. (Yom
 * Kippur ends at nightfall as well, but is surfaced as havdalah, not here.)
 *
 * Every opinion reads its time from a computed zman (`zmanKey`). Order is
 * earliest → latest at the Jerusalem equinox.
 */
export type FastEndKind = 'gmarTaanis' | 'nightfall';

export interface FastEndOpinionDef {
  /** Stable id: the hide-list key, the `events.fastEndOpinions` label key, and DayEvent.zmanKey. */
  key: string;
  kind: FastEndKind;
  /** The computed-zman key whose time this opinion uses. */
  zmanKey: string;
  order: number;
}

export const FAST_END_OPINIONS: readonly FastEndOpinionDef[] = [
  // ── Gmar taanis — end of a minor rabbinic fast (three medium stars) ──
  { key: 'tzaisGeonim', kind: 'gmarTaanis', zmanKey: 'tzaisGeonim', order: 10 }, // Baal HaTanya 5.95°
  { key: 'tzaisGeonim645', kind: 'gmarTaanis', zmanKey: 'tzaisGeonim645', order: 14 }, // R' Tukachinsky 6.45°
  { key: 'tzaisGeonim7083', kind: 'gmarTaanis', zmanKey: 'tzaisGeonim7083', order: 18 }, // R' Moshe Feinstein 7.083°
  // ── Nightfall — three small stars (all fasts, incl. Tisha b'Av) ──
  { key: 'tzais', kind: 'nightfall', zmanKey: 'tzais', order: 30 }, // 8.5°
  { key: 'tzais42', kind: 'nightfall', zmanKey: 'tzais42', order: 32 }, // fixed 42 min
  { key: 'tzais72', kind: 'nightfall', zmanKey: 'tzais72', order: 34 }, // Rabbeinu Tam 72 min
] as const;

export type FastEndOpinionKey = (typeof FAST_END_OPINIONS)[number]['key'];

const FAST_END_KEYS = new Set(FAST_END_OPINIONS.map((o) => o.key));

/** The computed-zman keys the fast-end opinions read their time from. */
export const FAST_END_ZMAN_KEYS: readonly string[] = FAST_END_OPINIONS.map((o) => o.zmanKey);

/**
 * Shown out of the box: three DISTINCT, commonly-used fast-end opinions in a
 * clear lenient→stringent spread — the early Geonim nightfall (5.95°), one
 * gmar-taanis "three medium stars" time (7.083°), and the standard "three small
 * stars" nightfall (8.5°, also the only default a major fast shows). Each has a
 * different label, so there's no confusing pair of near-identical rows. The
 * second medium-stars degree (6.45°), the fixed-minute poskim, and the later
 * nightfalls stay available but off by default.
 */
const DEFAULT_VISIBLE_FAST_END = new Set(['tzaisGeonim', 'tzaisGeonim7083', 'tzais']);

/** The default hidden set — the complement of DEFAULT_VISIBLE_FAST_END. */
export const DEFAULT_HIDDEN_FAST_END: readonly string[] = FAST_END_OPINIONS.filter(
  (o) => !DEFAULT_VISIBLE_FAST_END.has(o.key),
).map((o) => o.key);

const DEFAULT_HIDDEN_FAST_END_SET = new Set(DEFAULT_HIDDEN_FAST_END);

/** True when a fast-end hide-list is exactly the curated default (as a set). */
export function isDefaultHiddenFastEnd(hidden: readonly string[]): boolean {
  const set = new Set(hidden);
  if (set.size !== DEFAULT_HIDDEN_FAST_END_SET.size) return false;
  for (const key of set) if (!DEFAULT_HIDDEN_FAST_END_SET.has(key)) return false;
  return true;
}

/** Validate a persisted hidden-fast-end preference; drop unknown/malformed keys. */
export function sanitizeHiddenFastEnd(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((k): k is string => typeof k === 'string' && FAST_END_KEYS.has(k)))];
}

/**
 * The opinions offered for a fast of the given severity, in display order. A
 * minor fast may end at the lenient gmar-taanis OR the stringent nightfall; a
 * major fast (Tisha b'Av) only at nightfall.
 */
export function fastEndOpinionsFor(isMajorFast: boolean): readonly FastEndOpinionDef[] {
  return isMajorFast ? FAST_END_OPINIONS.filter((o) => o.kind === 'nightfall') : FAST_END_OPINIONS;
}
