import type { ZmanDefinition } from './types';

/**
 * The canonical set of zmanim, grouped by day-part, each bound to the EXACT
 * kosher-zmanim method that computes it. Zmanim sharing a `base` (e.g. the many
 * Alot / Tzeit opinions) are displayed together under one name, one row per
 * shita. Order is strict chronological order within a normal day (Jerusalem
 * equinox) and is asserted by the invariants test.
 *
 * Most opinions beyond the everyday defaults are OPT-IN — hidden until the user
 * enables them in settings (see `OPT_IN_ZMANIM` in visibility.ts) — so the
 * panel stays uncluttered while every documented shita is one toggle away.
 *
 * Method choices are cross-validated against Hebcal / KosherJava (see
 * calculator.golden.test.ts). Do not change a `method` without updating the
 * golden fixtures and the locked key→method mapping in definitions.test.ts.
 */
export const ZMANIM: readonly ZmanDefinition[] = [
  // ── Dawn ──────────────────────────────────────────────────────────────
  // Alot ha-Shachar — dawn. Earliest (most stringent) to latest, mixing
  // degree-based opinions (location-independent) and fixed/proportional minutes.
  { key: 'alos90', base: 'alos', method: 'getAlos90', category: 'dawn', order: 10 }, // fixed 90 min (4 mil × 22.5)
  { key: 'alos198', base: 'alos', method: 'getAlos19Point8Degrees', category: 'dawn', order: 12, fallback: { method: 'getAlos90Zmanis' } }, // 19.8° ≈ 90 min
  { key: 'alos18', base: 'alos', method: 'getAlos18Degrees', category: 'dawn', order: 14 }, // 18° astronomical twilight
  { key: 'alosBaalHatanya', base: 'alos', method: 'getAlosBaalHatanya', category: 'dawn', order: 16 }, // 16.9°
  { key: 'alos72Zmanis', base: 'alos', method: 'getAlos72Zmanis', category: 'dawn', order: 18 }, // 72 proportional min
  { key: 'alosHashachar', base: 'alos', method: 'getAlosHashachar', category: 'dawn', order: 20, fallback: { method: 'getAlos72Zmanis' } }, // 16.1° ≈ 72 min
  { key: 'alos72', base: 'alos', method: 'getAlos72', category: 'dawn', order: 22 }, // fixed 72 min (MGA day)
  { key: 'alos60', base: 'alos', method: 'getAlos60', category: 'dawn', order: 24 }, // fixed 60 min

  // Misheyakir — earliest tallit & tefillin. Earliest (11.5°) to latest (7.65°).
  // Short-night fallbacks offset the documented equinox anchor as seasonal minutes.
  { key: 'misheyakir115', base: 'misheyakir', method: 'getMisheyakir11Point5Degrees', category: 'dawn', order: 30, fallback: { anchor: 'sunrise', zmaniyosMinutes: 50 } },
  { key: 'misheyakir11', base: 'misheyakir', method: 'getMisheyakir11Degrees', category: 'dawn', order: 32, fallback: { anchor: 'sunrise', zmaniyosMinutes: 48 } },
  { key: 'misheyakir102', base: 'misheyakir', method: 'getMisheyakir10Point2Degrees', category: 'dawn', order: 34, fallback: { anchor: 'sunrise', zmaniyosMinutes: 44 } },
  { key: 'misheyakir95', base: 'misheyakir', method: 'getMisheyakir9Point5Degrees', category: 'dawn', order: 36, fallback: { anchor: 'sunrise', zmaniyosMinutes: 41 } },
  { key: 'misheyakir765', base: 'misheyakir', method: 'getMisheyakir7Point65Degrees', category: 'dawn', order: 38, fallback: { anchor: 'sunrise', zmaniyosMinutes: 32 } },

  // ── Morning ───────────────────────────────────────────────────────────
  { key: 'sunrise', base: 'sunrise', method: 'getSunrise', category: 'morning', order: 50 },

  // Sof zman Shma — end of the 3rd seasonal hour. MGA (dawn→nightfall day)
  // variants are earlier; GRA (sunrise→sunset) is the latest common opinion.
  { key: 'sofZmanShmaMGA90', base: 'sofZmanShma', method: 'getSofZmanShmaMGA90Minutes', category: 'morning', order: 60 },
  { key: 'sofZmanShmaMGA18', base: 'sofZmanShma', method: 'getSofZmanShmaMGA18Degrees', category: 'morning', order: 62 },
  { key: 'sofZmanShmaMGA161', base: 'sofZmanShma', method: 'getSofZmanShmaMGA16Point1Degrees', category: 'morning', order: 64 },
  { key: 'sofZmanShmaMGA', base: 'sofZmanShma', method: 'getSofZmanShmaMGA', category: 'morning', order: 66 }, // 72 min
  { key: 'sofZmanShmaBaalHatanya', base: 'sofZmanShma', method: 'getSofZmanShmaBaalHatanya', category: 'morning', order: 68 },
  { key: 'sofZmanShmaGRA', base: 'sofZmanShma', method: 'getSofZmanShmaGRA', category: 'morning', order: 70 },

  // Sof zman Tefila — end of the 4th seasonal hour (same day-length opinions).
  { key: 'sofZmanTfilaMGA90', base: 'sofZmanTfila', method: 'getSofZmanTfilaMGA90Minutes', category: 'morning', order: 80 },
  { key: 'sofZmanTfilaMGA18', base: 'sofZmanTfila', method: 'getSofZmanTfilaMGA18Degrees', category: 'morning', order: 82 },
  { key: 'sofZmanTfilaMGA161', base: 'sofZmanTfila', method: 'getSofZmanTfilaMGA16Point1Degrees', category: 'morning', order: 84 },
  { key: 'sofZmanTfilaMGA', base: 'sofZmanTfila', method: 'getSofZmanTfilaMGA', category: 'morning', order: 86 }, // 72 min
  { key: 'sofZmanTfilaBaalHatanya', base: 'sofZmanTfila', method: 'getSofZmanTfilaBaalHatanya', category: 'morning', order: 88 },
  { key: 'sofZmanTfilaGRA', base: 'sofZmanTfila', method: 'getSofZmanTfilaGRA', category: 'morning', order: 90 },

  // Erev Pesach chametz deadlines — end of the 4th proportional hour (eating)
  // and the 5th (burning), each by MGA (day = alos 72 → tzais 72) and GRA
  // (sunrise → sunset). Computed every day but only surfaced on 14 Nissan.
  { key: 'sofZmanAchilasChametzMGA', base: 'achilasChametz', method: 'getSofZmanAchilasChametzMGA72Minutes', category: 'morning', order: 92, erevPesachOnly: true },
  { key: 'sofZmanAchilasChametzGRA', base: 'achilasChametz', method: 'getSofZmanAchilasChametzGRA', category: 'morning', order: 94, erevPesachOnly: true },
  { key: 'sofZmanBiurChametzMGA', base: 'biurChametz', method: 'getSofZmanBiurChametzMGA72Minutes', category: 'morning', order: 96, erevPesachOnly: true },
  { key: 'sofZmanBiurChametzGRA', base: 'biurChametz', method: 'getSofZmanBiurChametzGRA', category: 'morning', order: 98, erevPesachOnly: true },

  // ── Midday ────────────────────────────────────────────────────────────
  { key: 'chatzos', base: 'chatzos', method: 'getChatzos', category: 'midday', order: 110 },

  // ── Afternoon ─────────────────────────────────────────────────────────
  // Mincha Gedola — earliest Mincha (½ seasonal hour after midday).
  { key: 'minchaGedola30', base: 'minchaGedola', method: 'getMinchaGedola30Minutes', category: 'afternoon', order: 120 }, // fixed 30 min after chatzot
  { key: 'minchaGedola', base: 'minchaGedola', method: 'getMinchaGedola', category: 'afternoon', order: 122 }, // GRA
  { key: 'minchaGedolaBaalHatanya', base: 'minchaGedola', method: 'getMinchaGedolaBaalHatanya', category: 'afternoon', order: 124 },
  { key: 'minchaGedola161', base: 'minchaGedola', method: 'getMinchaGedola16Point1Degrees', category: 'afternoon', order: 126 }, // MGA 16.1°

  // Mincha Ketana — preferred Mincha (9½ seasonal hours into the day).
  { key: 'minchaKetana', base: 'minchaKetana', method: 'getMinchaKetana', category: 'afternoon', order: 130 }, // GRA
  { key: 'minchaKetanaBaalHatanya', base: 'minchaKetana', method: 'getMinchaKetanaBaalHatanya', category: 'afternoon', order: 132 },
  { key: 'minchaKetana161', base: 'minchaKetana', method: 'getMinchaKetana16Point1Degrees', category: 'afternoon', order: 134 }, // MGA 16.1°

  // Plag ha-Mincha — 10¾ seasonal hours into the day.
  { key: 'plagHamincha', base: 'plagHamincha', method: 'getPlagHamincha', category: 'afternoon', order: 140 }, // GRA
  { key: 'plagBaalHatanya', base: 'plagHamincha', method: 'getPlagHaminchaBaalHatanya', category: 'afternoon', order: 142 },

  // ── Evening & night ───────────────────────────────────────────────────
  { key: 'candleLighting', base: 'candleLighting', method: 'getCandleLighting', category: 'evening', order: 150, erevOnly: true },
  { key: 'sunset', base: 'sunset', method: 'getSunset', category: 'evening', order: 152 },

  // Tzeit ha-Kochavim — nightfall. Earliest (lenient Geonim) to latest
  // (stringent Rabbeinu Tam). Degree opinions are location-independent; fixed
  // and proportional minutes are not, so their relative order can shift by
  // latitude/season (the invariants test deliberately does not pin it).
  // 5.95° — the Baal HaTanya's nightfall (Siddur Admur haZaken); matches myzmanim
  // to the second. Supersedes the 6° getTzaisBaalHatanya, which was 16s later.
  // Short-night fallbacks offset the documented equinox anchor as seasonal minutes.
  { key: 'tzaisGeonim', base: 'tzais', method: 'getTzaisGeonim5Point95Degrees', category: 'evening', order: 160, fallback: { anchor: 'sunset', zmaniyosMinutes: 24 } },
  { key: 'tzaisGeonim645', base: 'tzais', method: 'getTzaisGeonim6Point45Degrees', category: 'evening', order: 164, fallback: { anchor: 'sunset', zmaniyosMinutes: 26 } }, // R' Tukachinsky 6.45°
  { key: 'tzaisGeonim7083', base: 'tzais', method: 'getTzaisGeonim7Point083Degrees', category: 'evening', order: 166, fallback: { anchor: 'sunset', zmaniyosMinutes: 29 } }, // R' Moshe Feinstein 7.083°
  { key: 'tzais', base: 'tzais', method: 'getTzais', category: 'evening', order: 168, fallback: { anchor: 'sunset', zmaniyosMinutes: 36 } }, // 8.5° — 3 small stars
  { key: 'tzaisAteretTorah', base: 'tzais', method: 'getTzaisAteretTorah', category: 'evening', order: 170 }, // 40 min
  // 42 fixed minutes after sunset. kosher-zmanim has no getTzais42 (only 50/60/72…),
  // so it's expressed as getSunset + 42. Matches zmanim_api/zmanim_bot's tzeis_42_minutes.
  { key: 'tzais42', base: 'tzais', method: 'getSunset', offsetMinutes: 42, category: 'evening', order: 172 },
  { key: 'tzais50', base: 'tzais', method: 'getTzais50', category: 'evening', order: 174 }, // Igros Moshe
  { key: 'tzais60', base: 'tzais', method: 'getTzais60', category: 'evening', order: 176 }, // fixed 60 min
  { key: 'tzais72', base: 'tzais', method: 'getTzais72', category: 'evening', order: 178 }, // Rabbeinu Tam, fixed 72 min
  { key: 'tzais161', base: 'tzais', method: 'getTzais16Point1Degrees', category: 'evening', order: 180, fallback: { method: 'getTzais72Zmanis' } }, // Rabbeinu Tam, 16.1°
  { key: 'tzais72Zmanis', base: 'tzais', method: 'getTzais72Zmanis', category: 'evening', order: 182 }, // 72 proportional min
  { key: 'tzais18', base: 'tzais', method: 'getTzais18Degrees', category: 'evening', order: 184 }, // 18°
  { key: 'tzais90', base: 'tzais', method: 'getTzais90', category: 'evening', order: 186 }, // fixed 90 min
  { key: 'chatzosLaila', base: 'chatzosLaila', method: 'getSolarMidnight', category: 'evening', order: 190 },

  // Shaah zmanis (seasonal hour) — the LENGTH of one proportional hour, shown
  // as a duration rather than a clock time (hence last, after all the moments
  // of the day). MGA divides alos 72 → tzais 72; GRA sunrise → sunset. Matches
  // zmanim_api/zmanim_bot's astronomical_hour_ma / astronomical_hour_gra.
  { key: 'shaahZmanisMGA', base: 'shaahZmanis', method: 'getShaahZmanisMGA', category: 'evening', order: 200, duration: true },
  { key: 'shaahZmanisGRA', base: 'shaahZmanis', method: 'getShaahZmanisGra', category: 'evening', order: 202, duration: true },
] as const;
