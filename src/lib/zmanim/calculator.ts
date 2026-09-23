import { ComplexZmanimCalendar, GeoLocation } from 'kosher-zmanim';
import { DateTime } from 'luxon';

import { tzFromLatLng } from '../geo/timezone';
import { ZMANIM } from './definitions';
import type { ComputedZman, ComputeZmanimInput } from './types';

/**
 * GeoLocation with a correct antimeridian test.
 *
 * KosherJava rolls the calculation date a day when a place's longitude and its
 * zone's offset disagree by 20 hours or more — the Samoa / Chatham case, a zone
 * across the date line from its longitude. kosher-zmanim 0.9 takes that offset
 * from a TimeZone.getRawOffset polyfill which gets it wrong for every zone with
 * daylight saving: it returns the negated standard offset (-10 h for Sydney,
 * -12 h for Auckland, +9 h for Adak). Sydney's 151.2°E then scored
 * 10.08 − (−10) = 20.08 h, and every zman was computed for the NEXT day — the
 * wrong day's sun, not just a wrong date label. All of New Zealand, Lord Howe
 * and Norfolk went forward a day the same way, Adak went back a day, and
 * Chatham lost the adjustment it genuinely needs.
 *
 * This subclass uses the offset in effect at the requested day's local noon,
 * as current KosherJava does (getLocalMeanTimeOffset(Instant)). With the right
 * sign an ordinary zone scores within a few hours of zero, so daylight saving
 * never nears the threshold; and a zone that changed sides of the date line
 * (Kwajalein, August 1993) is judged by the rule it had on that day, which a
 * whole-year sample would not do. Overriding the one method the test reads
 * (via getAntimeridianAdjustment and AstronomicalCalendar.getAdjustedDate)
 * fixes it without patching the library globally.
 */
class DateLineSafeGeoLocation extends GeoLocation {
  private readonly offsetMillis: number;

  constructor(lat: number, lng: number, elevation: number, timeZoneId: string, localNoon: DateTime) {
    super(null, lat, lng, elevation, timeZoneId);
    this.offsetMillis = localNoon.offset * 60_000;
  }

  override getLocalMeanTimeOffset(): number {
    return this.getLongitude() * 4 * 60_000 - this.offsetMillis;
  }
}

/**
 * Compute the full set of zmanim for a location and date.
 *
 * Important: kosher-zmanim returns every time as a UTC `DateTime`. We convert
 * each one into the location's own timezone so the UI renders correct local
 * wall-clock times (including across DST transitions) regardless of the
 * browser's timezone.
 */
export function computeZmanim(input: ComputeZmanimInput): ComputedZman[] {
  const { lat, lng, date, elevation = 0, useElevation = false, candleLightingOffset = 18 } = input;
  const timeZoneId = input.timeZoneId ?? tzFromLatLng(lat, lng);

  // Elevation is all-or-nothing: the raw getSunrise/getSunset honor the
  // GeoLocation elevation regardless of kosher-zmanim's useElevation flag, so
  // a nonzero elevation without the flag would shift only those two rows and
  // leave every derived zman at sea level — an inconsistent panel. When the
  // user hasn't opted in, the elevation itself is zeroed. Negative elevations
  // (Dead Sea basin) also clamp to sea level: GeoLocation rejects them, and
  // the horizon-dip adjustment is only defined for an elevated observer.
  const effectiveElevation = useElevation ? Math.max(0, elevation) : 0;
  // Anchor on the calendar date (year/month/day as given) at noon IN THE
  // LOCATION'S timezone. We must NOT `setZone` the instant — that would shift
  // the day across timezone/DST boundaries (e.g. computing the previous day).
  const localNoon = DateTime.fromObject(
    { year: date.year, month: date.month, day: date.day, hour: 12 },
    { zone: timeZoneId },
  );
  const geo = new DateLineSafeGeoLocation(lat, lng, effectiveElevation, timeZoneId, localNoon);
  const calendar = new ComplexZmanimCalendar(geo);
  // With the flag on, sunrise/sunset (and fixed-minute zmanim measured from
  // them, e.g. alos 72 / tzais 72) become elevation-adjusted. Degree-based
  // zmanim, chatzos and candle lighting intentionally stay sea-level, matching
  // KosherJava semantics and Hebcal's `ue=on` behavior.
  calendar.setUseElevation(effectiveElevation > 0);
  calendar.setCandleLightingOffset(candleLightingOffset);
  calendar.setDate(localNoon);

  // Compute only the requested subset when `keys` is given — the grid and
  // exports pass just the keys they render, avoiding dozens of unused solar
  // calculations per day.
  const wanted = input.keys ? new Set(input.keys) : null;
  const defs = wanted ? ZMANIM.filter((d) => wanted.has(d.key)) : ZMANIM;

  return defs.map((def) => {
    // Duration zmanim (shaah zmanis): the method returns a length in ms, with
    // kosher-zmanim's Long.MIN_VALUE sentinel (NaN) when the day is undefined.
    if (def.duration) {
      const ms = (calendar[def.method] as unknown as () => number)();
      return { ...def, time: null, durationMillis: Number.isFinite(ms) ? ms : null };
    }
    const base = (calendar[def.method] as () => DateTime | null)();
    const raw = base && def.offsetMinutes != null ? base.plus({ minutes: def.offsetMinutes }) : base;
    // A null here is a real answer: this opinion has no time today. Most often a
    // `degrees` zman on a short night, where the sun never reaches the angle. It
    // is reported as null and never filled from another family — see ComputedZman.
    const time = raw ? raw.setZone(timeZoneId) : null;
    return { ...def, time };
  });
}

/**
 * True when the day has no sunrise or no sunset — a polar day/night, where the
 * sun never crosses the horizon at all. On such a day EVERY sun-dependent zman
 * is null (not just the degree-based ones), so the short-night "the sun never
 * reaches this angle, but other opinions still have a time" explanation would
 * be false: there are no other times to point to. Callers use this to suppress
 * that explanation, leaving the bare dashes to speak for the (rare) polar case.
 */
export function isPolarDay(zmanim: ComputedZman[]): boolean {
  const timeOf = (key: string) => zmanim.find((z) => z.key === key)?.time ?? null;
  return !timeOf('sunrise') || !timeOf('sunset');
}

/**
 * Convenience: compute zmanim already sorted chronologically by their actual
 * computed time (falling back to the definition order when a time is null).
 */
export function computeZmanimSorted(input: ComputeZmanimInput): ComputedZman[] {
  return [...computeZmanim(input)].sort((a, b) => {
    if (a.time && b.time) return a.time.toMillis() - b.time.toMillis();
    return a.order - b.order;
  });
}
