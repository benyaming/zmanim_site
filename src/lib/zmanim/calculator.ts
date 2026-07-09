import { ComplexZmanimCalendar, GeoLocation } from 'kosher-zmanim';
import { DateTime } from 'luxon';

import { tzFromLatLng } from '../geo/timezone';
import { ZMANIM } from './definitions';
import type { ComputedZman, ComputeZmanimInput } from './types';

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
  const geo = new GeoLocation(null, lat, lng, effectiveElevation, timeZoneId);
  const calendar = new ComplexZmanimCalendar(geo);
  // With the flag on, sunrise/sunset (and fixed-minute zmanim measured from
  // them, e.g. alos 72 / tzais 72) become elevation-adjusted. Degree-based
  // zmanim, chatzos and candle lighting intentionally stay sea-level, matching
  // KosherJava semantics and Hebcal's `ue=on` behavior.
  calendar.setUseElevation(effectiveElevation > 0);
  calendar.setCandleLightingOffset(candleLightingOffset);
  // Anchor on the calendar date (year/month/day as given) at noon IN THE
  // LOCATION'S timezone. We must NOT `setZone` the instant — that would shift
  // the day across timezone/DST boundaries (e.g. computing the previous day).
  const localNoon = DateTime.fromObject(
    { year: date.year, month: date.month, day: date.day, hour: 12 },
    { zone: timeZoneId },
  );
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
    const time = raw ? raw.setZone(timeZoneId) : null;
    return { ...def, time };
  });
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
