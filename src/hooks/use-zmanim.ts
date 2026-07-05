'use client';

import { useMemo } from 'react';

import { useAppState } from '@/components/providers/app-state';
import { applyLehumra, computeZmanim } from '@/lib/zmanim';

/** Zmanim for the currently selected day & location. Pure/synchronous — memoized. */
export function useZmanim() {
  const { location, selectedDay, candleLightingOffset, useElevation, lehumra } = useAppState();
  return useMemo(() => {
    const zmanim = computeZmanim({
      lat: location.lat,
      lng: location.lng,
      date: selectedDay,
      elevation: location.elevation,
      useElevation,
      timeZoneId: location.timeZoneId,
      candleLightingOffset,
    });
    // Display-level stringent rounding — the raw computation stays exact.
    return lehumra ? applyLehumra(zmanim) : zmanim;
  }, [
    location.lat,
    location.lng,
    location.elevation,
    location.timeZoneId,
    selectedDay,
    candleLightingOffset,
    useElevation,
    lehumra,
  ]);
}
