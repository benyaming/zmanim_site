'use client';

import { useMemo } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { computeZmanim } from '@/lib/zmanim';

/** Zmanim for the currently selected day & location. Pure/synchronous — memoized. */
export function useZmanim() {
  const { location, selectedDay, candleLightingOffset } = useAppState();
  return useMemo(
    () =>
      computeZmanim({
        lat: location.lat,
        lng: location.lng,
        date: selectedDay,
        timeZoneId: location.timeZoneId,
        candleLightingOffset,
      }),
    [location.lat, location.lng, location.timeZoneId, selectedDay, candleLightingOffset],
  );
}
