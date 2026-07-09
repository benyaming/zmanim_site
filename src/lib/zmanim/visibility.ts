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
 * Zmanim introduced as strictly OPT-IN: hidden by default for everyone,
 * including users whose persisted hide list predates them. The hide-list
 * convention normally makes a newly added zman visible to existing users;
 * app-state's load migration reverses that for these keys — exactly once per
 * key, tracked via the persisted `seenOptInZmanim` list — so they only appear
 * when explicitly enabled in the settings picker.
 *
 * These are the opinions ADDED beyond the ones the app already offered — the
 * extra Alot / Misheyakir / Sof-zman / Mincha / Plag / Tzeit shitot, plus the
 * two shaah-zmanis durations that shipped opt-in earlier. Keeping them opt-in
 * is what lets the panel ship a clean default while still offering every
 * documented shita.
 *
 * IMPORTANT: only list keys that did NOT exist before — the migration force-
 * hides unseen opt-in keys, which would wrongly override a user who had already
 * enabled a pre-existing zman (e.g. tzais72, misheyakir115). Never add a
 * previously-shippable key here.
 */
export const OPT_IN_ZMANIM: readonly string[] = [
  // Alot ha-Shachar
  'alos90',
  'alos198',
  'alos18',
  'alosBaalHatanya',
  'alos72Zmanis',
  'alos60',
  // Misheyakir
  'misheyakir95',
  'misheyakir765',
  // Sof zman Shma
  'sofZmanShmaMGA90',
  'sofZmanShmaMGA18',
  'sofZmanShmaMGA161',
  'sofZmanShmaBaalHatanya',
  // Sof zman Tefila
  'sofZmanTfilaMGA90',
  'sofZmanTfilaMGA18',
  'sofZmanTfilaMGA161',
  'sofZmanTfilaBaalHatanya',
  // Mincha Gedola
  'minchaGedola30',
  'minchaGedolaBaalHatanya',
  'minchaGedola161',
  // Mincha Ketana
  'minchaKetanaBaalHatanya',
  'minchaKetana161',
  // Plag ha-Mincha
  'plagBaalHatanya',
  // Tzeit ha-Kochavim
  'tzaisGeonim645',
  'tzaisGeonim7083',
  'tzaisAteretTorah',
  'tzais50',
  'tzais60',
  'tzais161',
  'tzais72Zmanis',
  'tzais18',
  'tzais90',
  // Shaah zmanis (seasonal hour) durations
  'shaahZmanisMGA',
  'shaahZmanisGRA',
];

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
