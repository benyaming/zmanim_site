import { tzFromLatLng } from './geo/timezone';

export interface AppLocation {
  lat: number;
  lng: number;
  timeZoneId: string;
  label: string;
  /**
   * The UI locale the label was resolved in. When it doesn't match the active
   * locale the label is re-resolved (see the app-state relabel effect), so a
   * persisted "Петах-Тиква" doesn't survive a switch to English. Absent when
   * the label's language is unknown (deep-link labels, older saved prefs).
   */
  labelLocale?: string;
  /**
   * User-given display name (from a saved location, e.g. "Home"). Shown in
   * place of `label` when present. Deliberately untouched by the locale
   * relabel effect, which only re-resolves the geocoded `label`.
   */
  customLabel?: string;
  /** Whether to use the Israel luach (1-day Yom Tov, Israel parsha schedule). */
  inIsrael: boolean;
  /**
   * Meters above sea level. Can be negative (Dead Sea basin). Absent until
   * resolved — geocoder search results carry it; other sources (GPS, IP,
   * bundled localities, legacy saves) are backfilled best-effort from the Open-Meteo
   * elevation API (see the app-state effect). Only affects zmanim when the
   * user opts in via the `useElevation` preference.
   */
  elevation?: number;
}

/**
 * A location is treated as "in Israel" (for the Jewish calendar) by its timezone.
 * Fresh lookups normalize `Asia/Hebron`/`Asia/Gaza` away (see `tzFromLatLng`),
 * but they survive in locations persisted before that normalization existed —
 * all of them are Eretz Yisrael for the luach (1-day Yom Tov, Israel parsha).
 */
export function isIsraelTimezone(timeZoneId: string): boolean {
  return timeZoneId === 'Asia/Jerusalem' || timeZoneId === 'Asia/Hebron' || timeZoneId === 'Asia/Gaza';
}

/**
 * Build a location, resolving its IANA timezone locally from the coordinates.
 * Pass `labelLocale` when the label is known to be in a specific UI language;
 * omit it for language-neutral or unknown labels.
 */
export function makeLocation(
  lat: number,
  lng: number,
  label: string,
  labelLocale?: string,
  elevation?: number,
): AppLocation {
  const timeZoneId = tzFromLatLng(lat, lng);
  return { lat, lng, timeZoneId, label, labelLocale, inIsrael: isIsraelTimezone(timeZoneId), elevation };
}

export const DEFAULT_LOCATION: AppLocation = {
  lat: 31.778,
  lng: 35.2354,
  timeZoneId: 'Asia/Jerusalem',
  label: 'Jerusalem',
  inIsrael: true,
};

/**
 * Whether a location is the un-chosen fallback (same coordinates as
 * {@link DEFAULT_LOCATION}). Such a value can land in storage from the eager
 * persist-on-mount, so it must NOT count as an explicit choice — otherwise it
 * would permanently suppress IP/GPS auto-detection. Compared by coordinates only,
 * since the label is localized per locale; a real Jerusalem pick from search
 * carries its own (different) coordinates, so this won't misfire on it.
 */
export function isDefaultLocation(loc: AppLocation): boolean {
  return loc.lat === DEFAULT_LOCATION.lat && loc.lng === DEFAULT_LOCATION.lng;
}
