'use client';

import { DateTime } from 'luxon';
import { createContext, useContext, useEffect, useState } from 'react';

import type { CalendarMode } from '@/lib/calendar';
import { type AppLocation, DEFAULT_LOCATION, isIsraelTimezone, makeLocation } from '@/lib/location';

export { DEFAULT_LOCATION, makeLocation };
export type { AppLocation };

export const DEFAULT_CANDLE_OFFSET = 18;

interface AppStateValue {
  location: AppLocation;
  setLocation: (loc: AppLocation) => void;
  /** The month currently being viewed (anchored on the 15th). */
  monthDate: DateTime;
  setMonthDate: (d: DateTime) => void;
  mode: CalendarMode;
  setMode: (m: CalendarMode) => void;
  toggleMode: () => void;
  /** The day whose zmanim are shown in the panel. */
  selectedDay: DateTime;
  setSelectedDay: (d: DateTime) => void;
  /** Candle-lighting minutes before sunset. */
  candleLightingOffset: number;
  setCandleLightingOffset: (m: number) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const STORAGE_KEY = 'zmanim:prefs:v1';

interface PersistedPrefs {
  location?: AppLocation;
  candleLightingOffset?: number;
}

function loadPrefs(): PersistedPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedPrefs) : null;
  } catch {
    return null;
  }
}

export function AppStateProvider({
  children,
  initialLocation,
}: {
  children: React.ReactNode;
  initialLocation?: AppLocation;
}) {
  const today = DateTime.now();
  const urlProvided = Boolean(initialLocation);
  const [location, setLocation] = useState<AppLocation>(initialLocation ?? DEFAULT_LOCATION);
  const [monthDate, setMonthDate] = useState<DateTime>(today.set({ day: 15 }).startOf('day'));
  const [mode, setMode] = useState<CalendarMode>('gregorian');
  const [selectedDay, setSelectedDay] = useState<DateTime>(today.startOf('day'));
  const [candleLightingOffset, setCandleLightingOffset] = useState(DEFAULT_CANDLE_OFFSET);

  // Load saved preferences once after mount. Done in an effect (not the initial
  // render) so server and client first-render agree — avoids hydration drift.
  useEffect(() => {
    const prefs = loadPrefs();
    if (!prefs) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (prefs.candleLightingOffset != null) setCandleLightingOffset(prefs.candleLightingOffset);
    // A location from the URL (deep link) takes precedence over the saved one.
    // Backfill inIsrael for locations persisted before that field existed.
    if (!urlProvided && prefs.location) {
      const saved = prefs.location;
      setLocation({ ...saved, inIsrael: saved.inIsrael ?? isIsraelTimezone(saved.timeZoneId) });
    }
  }, [urlProvided]);

  // Persist preferences whenever they change.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ location, candleLightingOffset }));
    } catch {
      // Ignore storage errors (private mode, quota, etc.).
    }
  }, [location, candleLightingOffset]);

  // Restore calendar state (mode + selected day) from the URL on mount, so a
  // shared link reopens the same day. Read post-mount to stay hydration-safe.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const m = p.get('m');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (m === 'hebrew' || m === 'gregorian') setMode(m);
    const d = p.get('d');
    if (d) {
      const dt = DateTime.fromISO(d);
      if (dt.isValid) {
        setSelectedDay(dt.startOf('day'));
        setMonthDate(dt.set({ day: 15 }).startOf('day'));
      }
    }
  }, []);

  // Reflect mode + selected day in the URL (without a navigation) for sharing.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    p.set('m', mode);
    const iso = selectedDay.toISODate();
    if (iso) p.set('d', iso);
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }, [mode, selectedDay]);

  const toggleMode = () => setMode((m) => (m === 'gregorian' ? 'hebrew' : 'gregorian'));

  // The React Compiler memoizes this provider value automatically.
  const value: AppStateValue = {
    location,
    setLocation,
    monthDate,
    setMonthDate,
    mode,
    setMode,
    toggleMode,
    selectedDay,
    setSelectedDay,
    candleLightingOffset,
    setCandleLightingOffset,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
