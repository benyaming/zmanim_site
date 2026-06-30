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
  const { lat, lng, date, elevation = 0, candleLightingOffset = 18 } = input;
  const timeZoneId = input.timeZoneId ?? tzFromLatLng(lat, lng);

  const geo = new GeoLocation(null, lat, lng, elevation, timeZoneId);
  const calendar = new ComplexZmanimCalendar(geo);
  calendar.setCandleLightingOffset(candleLightingOffset);
  // Anchor on the calendar date (year/month/day as given) at noon IN THE
  // LOCATION'S timezone. We must NOT `setZone` the instant — that would shift
  // the day across timezone/DST boundaries (e.g. computing the previous day).
  const localNoon = DateTime.fromObject(
    { year: date.year, month: date.month, day: date.day, hour: 12 },
    { zone: timeZoneId },
  );
  calendar.setDate(localNoon);

  return ZMANIM.map((def) => {
    const raw = (calendar[def.method] as () => DateTime | null)();
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
