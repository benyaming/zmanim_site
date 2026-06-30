'use client';

import { useTranslations } from 'next-intl';
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
        try {
          const name = await reverseGeocode(latitude, longitude);
          if (name) label = name;
        } catch {
          // Reverse geocoding is best-effort; keep the fallback label.
        }
        setLocation(makeLocation(latitude, longitude, label));
        setLocating(false);
        onDone?.();
      },
      (err) => {
        setError(err.message || t('failed'));
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }, [setLocation, onDone, t]);

  return { locating, error, locate };
}
