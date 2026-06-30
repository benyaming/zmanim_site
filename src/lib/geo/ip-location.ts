import { type AppLocation, makeLocation } from '@/lib/location';

import { reverseGeocode } from './geocoding';

interface IpWhoIsResponse {
  success?: boolean;
  city?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Best-effort approximate location from the visitor's IP address. Keyless and
 * over HTTPS (ipwho.is), so it fits the app's no-secrets / all-client-side model.
 * Used only as a *soft* default on first load — an explicit choice (URL param or
 * a saved/manual location) always wins. Returns null on any failure so callers
 * fall back to {@link DEFAULT_LOCATION}.
 *
 * Accuracy is city-level at best and unreliable behind VPNs/proxies; the user
 * can always override via the location picker. The timezone is still resolved
 * locally from the coordinates (we don't trust the service for it).
 *
 * The label is reverse-geocoded in `locale` so the city reads in the active
 * language (e.g. "Петах-Тиква"), falling back to the IP service's English city
 * name and then `fallbackLabel`.
 */
export async function ipGeolocate(signal?: AbortSignal, locale = 'en', fallbackLabel = 'My location'): Promise<AppLocation | null> {
  try {
    const res = await fetch('https://ipwho.is/?fields=success,city,latitude,longitude', { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as IpWhoIsResponse;
    if (data.success === false) return null;
    const { latitude, longitude, city } = data;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

    let label = city?.trim() || fallbackLabel;
    try {
      const localized = await reverseGeocode(latitude, longitude, signal, locale);
      if (localized) label = localized;
    } catch {
      // Reverse geocoding is best-effort; keep the IP service's city name.
    }
    return makeLocation(latitude, longitude, label);
  } catch {
    // Network error, abort, bad JSON — all non-fatal; caller keeps the default.
    return null;
  }
}
