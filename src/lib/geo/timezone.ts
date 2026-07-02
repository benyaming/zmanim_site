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
  return normalizeIsraelAreaTimezone(tzlookup(clampedLat, clampedLng));
}

/**
 * Collapse `Asia/Hebron` / `Asia/Gaza` to `Asia/Jerusalem`.
 *
 * tz-lookup assigns the whole West Bank polygon to `Asia/Hebron`, and the
 * polygon is coarse enough to swallow Jerusalem neighborhoods (Gilo) and
 * Israeli cities near the Green Line (Ma'ale Adumim, Ariel). Users at those
 * coordinates observe the Israeli clock, and the Palestinian zones diverge
 * from Israel's DST transition dates for a few weeks in some years — so
 * keeping the raw zone would render zmanim an hour off the local wall clock.
 * It also breaks the `inIsrael` luach detection (see `isIsraelTimezone`).
 */
export function normalizeIsraelAreaTimezone(tz: string): string {
  return tz === 'Asia/Hebron' || tz === 'Asia/Gaza' ? 'Asia/Jerusalem' : tz;
}
