import type { ZmanDefinition } from './types';

/**
 * The canonical set of zmanim, grouped by day-part, each bound to the EXACT
 * kosher-zmanim method that computes it. Zmanim sharing a `base` (e.g. the three
 * Misheyakir opinions) are displayed together under one name. Order is strict
 * chronological order within a normal day and is asserted by the invariants test.
 *
 * Method choices are cross-validated to the second against Hebcal (see
 * calculator.golden.test.ts). Do not change a `method` without updating the
 * golden fixtures.
 */
export const ZMANIM: readonly ZmanDefinition[] = [
  // ── Dawn ──────────────────────────────────────────────────────────────
  { key: 'alosHashachar', base: 'alos', method: 'getAlosHashachar', category: 'dawn', order: 10 }, // 16.1°
  { key: 'alos72', base: 'alos', method: 'getAlos72', category: 'dawn', order: 15 }, // fixed 72 minutes
  // Misheyakir — the three common opinions, earliest (11.5°) to latest (10.2°).
  { key: 'misheyakir115', base: 'misheyakir', method: 'getMisheyakir11Point5Degrees', category: 'dawn', order: 20 }, // ≈52 min
  { key: 'misheyakir11', base: 'misheyakir', method: 'getMisheyakir11Degrees', category: 'dawn', order: 22 }, // ≈48 min
  { key: 'misheyakir102', base: 'misheyakir', method: 'getMisheyakir10Point2Degrees', category: 'dawn', order: 24 }, // ≈45 min

  // ── Morning ───────────────────────────────────────────────────────────
  { key: 'sunrise', base: 'sunrise', method: 'getSunrise', category: 'morning', order: 30 },
  { key: 'sofZmanShmaMGA', base: 'sofZmanShma', method: 'getSofZmanShmaMGA', category: 'morning', order: 40 },
  { key: 'sofZmanShmaGRA', base: 'sofZmanShma', method: 'getSofZmanShmaGRA', category: 'morning', order: 50 },
  { key: 'sofZmanTfilaMGA', base: 'sofZmanTfila', method: 'getSofZmanTfilaMGA', category: 'morning', order: 60 },
  { key: 'sofZmanTfilaGRA', base: 'sofZmanTfila', method: 'getSofZmanTfilaGRA', category: 'morning', order: 70 },

  // ── Midday ────────────────────────────────────────────────────────────
  { key: 'chatzos', base: 'chatzos', method: 'getChatzos', category: 'midday', order: 80 },

  // ── Afternoon ─────────────────────────────────────────────────────────
  { key: 'minchaGedola', base: 'minchaGedola', method: 'getMinchaGedola', category: 'afternoon', order: 90 },
  { key: 'minchaKetana', base: 'minchaKetana', method: 'getMinchaKetana', category: 'afternoon', order: 100 },
  { key: 'plagHamincha', base: 'plagHamincha', method: 'getPlagHamincha', category: 'afternoon', order: 110 },

  // ── Evening & night ───────────────────────────────────────────────────
  { key: 'candleLighting', base: 'candleLighting', method: 'getCandleLighting', category: 'evening', order: 115, erevOnly: true },
  { key: 'sunset', base: 'sunset', method: 'getSunset', category: 'evening', order: 120 },
  // Tzeit HaKochavim — Geonim (lenient) → 8.5° → Rabbeinu Tam (stringent).
  { key: 'tzaisGeonim', base: 'tzais', method: 'getTzaisGeonim5Point95Degrees', category: 'evening', order: 125 },
  { key: 'tzais', base: 'tzais', method: 'getTzais', category: 'evening', order: 130 }, // 8.5°
  // 42 fixed minutes after sunset. kosher-zmanim has no getTzais42 (only 50/60/72…),
  // so it's expressed as getSunset + 42. Matches zmanim_api/zmanim_bot's tzeis_42_minutes.
  { key: 'tzais42', base: 'tzais', method: 'getSunset', offsetMinutes: 42, category: 'evening', order: 135 },
  { key: 'tzais72', base: 'tzais', method: 'getTzais72', category: 'evening', order: 140 }, // Rabbeinu Tam
  { key: 'chatzosLaila', base: 'chatzosLaila', method: 'getSolarMidnight', category: 'evening', order: 150 },
] as const;
