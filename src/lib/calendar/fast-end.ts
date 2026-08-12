/**
 * End-of-fast opinions. A fast ends at tzeit ha-kochavim; the question is WHICH
 * tzeit. The opinions fall into two groups, by how stringent the tzeit is:
 *
 * - `gmarTaanis` — the end of a MINOR rabbinic fast (17 Tammuz, 10 Tevet, Tzom
 *   Gedaliah, Taanit Esther): the emergence of three MEDIUM stars, per myzmanim's
 *   "gmar hataaniyos." Degree-based and attributed to the poskim myzmanim's
 *   calculator uses — Baal HaTanya (5.95°), R' Tukachinsky (6.45°), R' Moshe
 *   Feinstein (7.083°) — each matching myzmanim to the second at Rosh HaAyin.
 * - `nightfall` — three SMALL stars, full nightfall. The stringent end. `tzais`
 *   8.5°, plus 42 min and Rabbeinu Tam 72 min.
 *
 * Every fast — minor or Tisha b'Av — surfaces whichever opinions the user has
 * left visible; the two groups are a display grouping (in settings), not a
 * per-fast filter. (Yom Kippur ends at nightfall as well, but is surfaced as
 * havdalah, not here.)
 *
 * Every opinion reads its time from a computed zman (`zmanKey`). Order is
 * earliest → latest at the Jerusalem equinox.
 */
export type FastEndKind = 'gmarTaanis' | 'nightfall';

export interface FastEndOpinionDef {
  /** Stable id: the hide-list key and DayEvent.zmanKey. Not a label key — see fastEndZmanKey. */
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

/**
 * The nightfall shown when every VISIBLE fast-end opinion is undefined on a
 * short summer night (all the default opinions are degree-based, and the sun
 * never reaches those angles). Rabbeinu Tam's fixed 72-minute nightfall — a
 * `nightfall`-kind opinion valid for every fast, including Tisha B'Av, and
 * defined wherever the sun sets. getDayEvents falls through to it, labelled, so
 * a fast never shows an all-blank end — mirroring the fast-START fall-through.
 */
export const FAST_END_FALLBACK: FastEndOpinionDef = FAST_END_OPINIONS.find((o) => o.key === 'tzais72')!;

const FAST_END_KEYS = new Set(FAST_END_OPINIONS.map((o) => o.key));

const ZMAN_KEY_BY_OPINION = new Map(FAST_END_OPINIONS.map((o) => [o.key, o.zmanKey]));

/**
 * The `zmanim.shitot` key an opinion is labelled by.
 *
 * Fast-end opinions used to carry their own `events.fastEndOpinions` strings —
 * a fourth copy of labels the zmanim catalog already had. It drifted: after the
 * shitot were rewritten to state each opinion in its own unit, every fast-end
 * label still read the old way ("Рабейну Там · 72 мин фикс." beside the panel's
 * "Рабейну Там · 72 минуты"), so the same nightfall appeared two ways depending
 * on where you looked. They now resolve through the canonical register, as
 * havdalah always has (see havdalahZmanKey).
 *
 * An opinion's key and its zmanKey happen to coincide today; going through the
 * definition keeps that a coincidence rather than an assumption.
 */
export function fastEndZmanKey(key: string): string {
  return ZMAN_KEY_BY_OPINION.get(key) ?? key;
}

/** The computed-zman keys the fast-end opinions read their time from. */
export const FAST_END_ZMAN_KEYS: readonly string[] = FAST_END_OPINIONS.map((o) => o.zmanKey);

/**
 * Shown out of the box: three DISTINCT, commonly-used fast-end opinions in a
 * clear lenient→stringent spread — the early Geonim nightfall (5.95°), one
 * gmar-taanis "three medium stars" time (7.083°), and the standard "three small
 * stars" nightfall (8.5°). Each has a different label, so there's no confusing
 * pair of near-identical rows. The second medium-stars degree (6.45°), the
 * fixed-minute poskim, and the later nightfalls stay available but off by default.
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
