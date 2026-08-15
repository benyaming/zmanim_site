'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';

import { makeLocation, useAppState } from '@/components/providers/app-state';
import { reverseGeocode } from '@/lib/geo/geocoding';

interface UseGeolocation {
  locating: boolean;
  error: string | null;
  /** Request the browser's location and set it as the active location. */
  locate: () => void;
}

/**
 * On-demand browser geolocation. Unlike the legacy app (which prompted for GPS
 * eagerly on first load), this only fires when the user explicitly asks.
 */
export function useGeolocation(onDone?: () => void): UseGeolocation {
  const t = useTranslations('location');
  const locale = useLocale();
  const { setLocation } = useAppState();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError(t('notSupported'));
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let label = t('myLocation');
        let labelLocale: string | undefined = locale; // the fallback label is localized too
        try {
          const name = await reverseGeocode(latitude, longitude, undefined, locale);
          if (name) label = name;
          else labelLocale = undefined;
        } catch {
          // Reverse geocoding is best-effort; keep the localized fallback but
          // leave labelLocale unset so a real city name can be resolved later.
          labelLocale = undefined;
        }
        setLocation(makeLocation(latitude, longitude, label, labelLocale));
        setLocating(false);
        onDone?.();
      },
      (err) => {
        setError(err.message || t('failed'));
        setLocating(false);
      },
      // High accuracy, and never from cache: the user pressed a button and is
      // waiting, and a coarse WiFi/IP fix can land kilometers away — enough to
      // cross a reverse-geocode boundary and label someone in Rosh HaAyin with
      // a West Bank town. `maximumAge` must be 0 rather than merely short,
      // because the position cache is not accuracy-aware: the silent
      // first-load path (`browserGeolocate`, coarse on purpose) can seed it
      // seconds earlier, and any non-zero window would hand that same coarse
      // fix straight back to the button meant to correct it.
      //
      // Timeout is longer than the background path's because a fresh
      // high-accuracy fix is slower than a cached one, and getCurrentPosition
      // errors out rather than degrading to a coarse reading on timeout.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [setLocation, onDone, t, locale]);

  return { locating, error, locate };
}
