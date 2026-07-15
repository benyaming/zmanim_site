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
 * Short-night fallback for a degree-based zman. At high latitudes the sun may
 * never reach a given depression angle (a short summer night), so the primary
 * `method` returns null. Rather than show nothing, we fall back to a fixed
 * seasonal-hour (shaah zmanit) approximation — flagged in the UI so the user
 * knows it isn't the real degree-based time. Only used when `method` is null;
 * a real degree time is never overridden.
 *
 * Two forms, both anchored on the (always-available-when-there-is-a-day)
 * sunrise/sunset:
 * - `method` — call another calendar method that is itself proportional
 *   (a `*Zmanis` method), e.g. `getAlos72Zmanis` as the equivalent of 16.1°.
 * - `anchor` + `zmaniyosMinutes` — offset that many SEASONAL minutes from
 *   sunrise (before) or sunset (after), matching KosherJava's convention
 *   (`sunrise − minutes × shaahZmanisGra / 60`). The minute figure is the
 *   documented Jerusalem-equinox anchor of the degree (see docs/zmanim.md).
 */
export type ZmanFallback =
  | { method: ZmanMethod }
  | { anchor: 'sunrise' | 'sunset'; zmaniyosMinutes: number };

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
  /**
   * Fallback for a short night, when the degree-based `method` yields no time
   * (the sun never reaches its depression angle). A seasonal-hour approximation
   * used ONLY when `method` is null, surfaced with `ComputedZman.approximate`.
   */
  fallback?: ZmanFallback;
}

/** A computed zman: the definition plus its resolved time (null if undefined that day). */
export interface ComputedZman extends ZmanDefinition {
  /** The time in the location's timezone, or null (e.g. polar day with no sunrise). */
  time: DateTime | null;
  /** For `duration` zmanim only: the length in ms, or null when the day is undefined. */
  durationMillis?: number | null;
  /**
   * True when `time` came from the short-night `fallback` (a seasonal-hour
   * approximation) because the degree-based method had no time. The UI marks
   * these with a warning so they're never mistaken for the exact degree time.
   */
  approximate?: boolean;
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
