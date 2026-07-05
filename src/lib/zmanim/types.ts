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

/** A computed zman: the definition plus its resolved time (null if undefined that day). */
export interface ComputedZman extends ZmanDefinition {
  /** The time in the location's timezone, or null (e.g. polar day with no sunrise). */
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
}
