import { type AppLocation, makeLocation } from '@/lib/location';

import { reverseGeocode } from './geocoding';

/**
 * Silent, best-effort precise location from the browser's Geolocation API.
 * Resolves to null on denial, error, or lack of support — never rejects — so the
 * caller can treat it as an optional upgrade over the IP soft-default.
 *
 * This is the *non-interactive* counterpart to {@link useGeolocation}, which is
 * the on-demand path (button) and surfaces errors/loading to the user. The
 * timezone is resolved locally from the coordinates by {@link makeLocation}.
 */
export function browserGeolocate(fallbackLabel = 'My location', locale = 'en'): Promise<AppLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let label = fallbackLabel;
        try {
          const name = await reverseGeocode(latitude, longitude, undefined, locale);
          if (name) label = name;
        } catch {
          // Reverse geocoding is best-effort; keep the fallback label.
        }
        resolve(makeLocation(latitude, longitude, label));
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  });
}
