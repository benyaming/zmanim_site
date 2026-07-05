'use client';

import { useMemo } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { computeZmanim } from '@/lib/zmanim';

/** Zmanim for the currently selected day & location. Pure/synchronous — memoized. */
export function useZmanim() {
  const { location, selectedDay, candleLightingOffset, useElevation } = useAppState();
  return useMemo(
    () =>
      computeZmanim({
        lat: location.lat,
        lng: location.lng,
        date: selectedDay,
        elevation: location.elevation,
        useElevation,
        timeZoneId: location.timeZoneId,
        candleLightingOffset,
      }),
    [location.lat, location.lng, location.elevation, location.timeZoneId, selectedDay, candleLightingOffset, useElevation],
  );
}
