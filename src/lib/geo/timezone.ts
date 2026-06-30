import tzlookup from 'tz-lookup';

/**
 * Resolve the IANA timezone id for a geographic point.
 *
 * The legacy app reached into a private `_z.name` field of `@mapbox/timespace`
 * behind a `@ts-ignore`. This replaces that with an offline, deterministic
 * lookup so zmanim always render in the correct local wall-clock (incl. DST),
 * never the browser's timezone.
 */
export function tzFromLatLng(lat: number, lng: number): string {
  // tz-lookup throws for out-of-range coordinates; clamp defensively.
  const clampedLat = Math.max(-90, Math.min(90, lat));
  const clampedLng = Math.max(-180, Math.min(180, lng));
  return tzlookup(clampedLat, clampedLng);
}
