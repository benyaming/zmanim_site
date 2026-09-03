'use client';

import { useSyncExternalStore } from 'react';

// The *primary* pointer, not `any-pointer`: a touchscreen laptop has a coarse
// pointer available but is driven by its mouse, and it should get the same
// controls as any other desktop. (CalendarGrid's swipe hint asks the opposite
// question — "can this device swipe at all?" — so it uses `any-pointer`.)
const QUERY = '(pointer: coarse)';

function mql(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(QUERY);
}

function subscribe(onChange: () => void) {
  const m = mql();
  if (!m) return () => {};
  m.addEventListener('change', onChange);
  return () => m.removeEventListener('change', onChange);
}

const getSnapshot = () => mql()?.matches ?? false;
const getServerSnapshot = () => false;

/**
 * Whether the device is driven by touch. Reactive (a tablet docked to a mouse
 * flips it live) and hydration-safe: false during SSR, so callers must render
 * behind the app's mount gate if the answer changes their markup.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
