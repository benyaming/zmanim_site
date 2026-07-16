import type { ComplexZmanimCalendar } from 'kosher-zmanim';
import type { DateTime } from 'luxon';

/** Day-part grouping used to section the zmanim display. */
export type ZmanCategory = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening';

/**
 * A method name on `ComplexZmanimCalendar`. This catches typos at compile time;
 * the definitions test additionally asserts at runtime that each one resolves
 * to a real function on the calendar prototype.
 */
export type ZmanMethod = Extract<keyof ComplexZmanimCalendar, string>;

/**
 * HOW a zman is calculated — the axis that distinguishes opinions answering the
 * same question in fundamentally different ways. Every Alot / Misheyakir / Tzeit
 * opinion is one of `degrees`, `fixedMinutes` or `seasonalMinutes`; the three
 * disagree about what dawn or nightfall even IS, not merely about a parameter.
 *
 * Modeling it as data (rather than leaving it implicit in a translated shita
 * label like "8.5°" or "72 min fix") is what lets the UI group and explain
 * opinions by family — in particular, why a `degrees` zman can have no time at
 * all at high latitude while its minute-based neighbours still resolve.
 *
 * A zman that is a MOMENT of twilight (alot, misheyakir, tzeit) is one of the
 * first three. A zman that is a FRACTION of the halachic day (sof zman Shma /
 * Tfila, chametz deadlines, mincha, plag, the shaah-zmanis durations) is one of
 * the two day-definition families — because for those opinions the fundamental
 * disagreement is over when the day begins and ends, not the arithmetic. (One
 * exception: mincha gedola 30 is a fixed 30-minute offset from chatzot, so it is
 * `fixedMinutes`, not a day-fraction at all.)
 *
 * - `degrees` — the sun reaches a depression angle below the horizon. The only
 *   family that can be UNDEFINED on a short night: at high latitude in summer
 *   the sun may never get that low, and no amount of arithmetic invents a time.
 * - `fixedMinutes` — a fixed clock-minute offset from sunrise/sunset (or from
 *   chatzot). Always defined whenever there is a sunrise and sunset.
 * - `seasonalMinutes` — a proportional (zmaniyos) minute offset, where a minute
 *   is 1/60 of a shaah zmanis and so stretches with the length of the day.
 * - `dawnToNightfall` — a fraction of the day measured dawn → nightfall (the
 *   longer day of the Magen Avraham). Its hours start earlier and run longer.
 * - `sunriseToSunset` — a fraction of the day measured sunrise → sunset (the
 *   day of the Vilna Gaon, and — from his own true sunrise — the Baal HaTanya).
 * - `solar` — the sun's own position: sunrise, sunset, chatzot, solar midnight.
 */
export type ZmanFamily =
  | 'degrees'
  | 'fixedMinutes'
  | 'seasonalMinutes'
  | 'dawnToNightfall'
  | 'sunriseToSunset'
  | 'solar';

/**
 * A single zman definition. This is the SINGLE SOURCE OF TRUTH that binds a
 * displayed time (`key`) to the exact kosher-zmanim calculation (`method`).
 * Name, shita label and description are looked up by `key` in the message
 * catalogs (zmanim.names / zmanim.shitot / zmanim.descriptions).
 */
export interface ZmanDefinition {
  /** Stable identifier; also the translation key and React key. */
  key: string;
  /** Base zman this belongs to. Rows sharing a base (e.g. the three Misheyakir
   *  opinions) are grouped under one name, with each shita as a sub-row. */
  base: string;
  /** The exact `ComplexZmanimCalendar` method that computes this time. */
  method: ZmanMethod;
  /**
   * How this zman is calculated. Pure metadata — it never affects the computed
   * time, only how the UI groups, filters and explains the row. Locked in
   * definitions.test.ts alongside the key→method mapping.
   */
  family: ZmanFamily;
  /**
   * Fixed minutes to add to `method`'s result. For tzeitim with no dedicated
   * kosher-zmanim method (e.g. tzeit 42 = sunset + 42 min). Omitted = use the
   * method's time as-is.
   */
  offsetMinutes?: number;
  /** Day-part group for sectioning the display. */
  category: ZmanCategory;
  /** Chronological sort order within a normal day (lower = earlier). */
  order: number;
  /** Only meaningful on Erev Shabbat / Erev Yom Tov (e.g. candle lighting). */
  erevOnly?: boolean;
  /** Only meaningful on Erev Pesach (14 Nissan) — the chametz deadlines. */
  erevPesachOnly?: boolean;
  /**
   * This zman is a LENGTH (the shaah zmanis / astronomical hour), not a moment
   * of the day: `method` returns milliseconds, surfaced as `durationMillis`
   * (`time` stays null and the UI renders an h:mm:ss duration).
   */
  duration?: boolean;
}

/**
 * A computed zman: the definition plus its resolved time.
 *
 * `time` is null when this opinion genuinely has no answer for the day — most
 * often a `degrees` zman on a short night, where the sun never reaches the
 * depression angle. That null is REPORTED, never filled in from another family:
 * substituting a minute-based time into a degree-based row would attribute a
 * number to a shita that did not produce it, and would quietly take a side in
 * an open machloket about what to do at high latitude. The UI explains the gap
 * and shows the neighbouring families instead (see `ZmanFamily`).
 */
export interface ComputedZman extends ZmanDefinition {
  /** The time in the location's timezone, or null when this opinion has no time that day. */
  time: DateTime | null;
  /** For `duration` zmanim only: the length in ms, or null when the day is undefined. */
  durationMillis?: number | null;
}

export interface ComputeZmanimInput {
  lat: number;
  lng: number;
  /** Any Luxon DateTime; only the calendar date is used. */
  date: DateTime;
  /**
   * Meters above sea level. Only applied when `useElevation` is true; may be
   * negative (Dead Sea basin), which clamps to sea level.
   */
  elevation?: number;
  /**
   * Opt-in: factor elevation into sunrise/sunset (visible-horizon dip) and the
   * zmanim derived from them. Defaults to false — standard published times
   * (and the Hebcal cross-validation) use sea level. Degree-based zmanim,
   * chatzos and candle lighting are unaffected by design; see calculator.ts.
   */
  useElevation?: boolean;
  /** IANA timezone id. Resolved from lat/lng when omitted. */
  timeZoneId?: string;
  /** Candle-lighting minutes before sunset. Defaults to 18 (40 is common for Jerusalem). */
  candleLightingOffset?: number;
  /**
   * Restrict computation to these zman keys (a performance optimization for
   * callers that only need a few — e.g. the calendar grid needs just the
   * event-dot times, not all 50+ opinions). Omitted = compute every zman.
   * Unknown keys are ignored; the result keeps definition order.
   */
  keys?: Iterable<string>;
}
