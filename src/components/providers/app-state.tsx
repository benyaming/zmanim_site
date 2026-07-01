'use client';

import { DateTime } from 'luxon';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { type CalendarMode, monthAnchor } from '@/lib/calendar';
import { browserGeolocate } from '@/lib/geo/browser-location';
import { ipGeolocate } from '@/lib/geo/ip-location';
import { type AppLocation, DEFAULT_LOCATION, isDefaultLocation, isIsraelTimezone, makeLocation } from '@/lib/location';
import { DEFAULT_HAVDALAH_OPINION, type HavdalahOpinion, isHavdalahOpinion } from '@/lib/zmanim';

export { DEFAULT_LOCATION, makeLocation };
export type { AppLocation };

export const DEFAULT_CANDLE_OFFSET = 18;
/** Candle lighting is always *before* sunset, so the offset must be ≥ 1 minute. */
export const CANDLE_OFFSET_MIN = 1;
export const CANDLE_OFFSET_MAX = 120;

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
  /** Which tzeit opinion determines the havdalah time. */
  havdalahOpinion: HavdalahOpinion;
  setHavdalahOpinion: (o: HavdalahOpinion) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const STORAGE_KEY = 'zmanim:prefs:v1';

interface PersistedPrefs {
  location?: AppLocation;
  candleLightingOffset?: number;
  havdalahOpinion?: HavdalahOpinion;
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
  children: ReactNode;
  initialLocation?: AppLocation;
}) {
  const today = DateTime.now();
  const urlProvided = Boolean(initialLocation);

  // Captured at mount for the one-shot auto-detect below, so the detected city is
  // labelled in the active language (and the effect deps stay [urlProvided]).
  const locale = useLocale();
  const tLocation = useTranslations('location');
  const localeRef = useRef(locale);
  const fallbackLabelRef = useRef(tLocation('myLocation'));

  // The fallback shown until auto-detection resolves (or if it fails) — Jerusalem,
  // with its name in the active language.
  const [location, setLocationState] = useState<AppLocation>(
    initialLocation ?? { ...DEFAULT_LOCATION, label: tLocation('defaultCity') },
  );

  // True once the location is explicitly chosen (URL deep link, saved pref, or a
  // user action). Guards the async IP soft-default from overwriting that choice.
  const locationLocked = useRef(urlProvided);
  const setLocation = (loc: AppLocation) => {
    locationLocked.current = true;
    setLocationState(loc);
  };
  const [monthDate, setMonthDate] = useState<DateTime>(monthAnchor(today, 'gregorian'));
  const [mode, setModeState] = useState<CalendarMode>('gregorian');
  const [selectedDay, setSelectedDay] = useState<DateTime>(today.startOf('day'));

  // Switching calendar system re-anchors on the *currently viewed* month (not the
  // selected day), so you keep looking at the same period. Since monthDate always
  // sits mid-month (the 15th), re-anchoring in the new mode lands on the month that
  // overlaps the current view the most.
  const setMode = (m: CalendarMode) => {
    setModeState(m);
    setMonthDate(monthAnchor(monthDate, m));
  };
  const [candleLightingOffset, setCandleLightingOffset] = useState(DEFAULT_CANDLE_OFFSET);
  const [havdalahOpinion, setHavdalahOpinion] = useState<HavdalahOpinion>(DEFAULT_HAVDALAH_OPINION);

  // Load saved preferences once after mount. Done in an effect (not the initial
  // render) so server and client first-render agree — avoids hydration drift.
  useEffect(() => {
    const prefs = loadPrefs();
    if (!prefs) return;
    // Apply a saved offset only if it's a sane value; otherwise keep the default
    // (this also heals a previously-persisted 0, which is invalid for candle lighting).
    const savedOffset = prefs.candleLightingOffset;
    if (typeof savedOffset === 'number' && Number.isFinite(savedOffset) && savedOffset >= CANDLE_OFFSET_MIN) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCandleLightingOffset(Math.min(CANDLE_OFFSET_MAX, Math.round(savedOffset)));
    }
    if (isHavdalahOpinion(prefs.havdalahOpinion)) setHavdalahOpinion(prefs.havdalahOpinion);
    // A location from the URL (deep link) takes precedence over the saved one.
    // Ignore a persisted *default* (eager-persisted, not a real choice) so it
    // doesn't lock out auto-detection. Backfill inIsrael for locations persisted
    // before that field existed.
    if (!urlProvided && prefs.location && !isDefaultLocation(prefs.location)) {
      const saved = prefs.location;
      locationLocked.current = true; // a saved location is an explicit choice
      setLocationState({ ...saved, inIsrael: saved.inIsrael ?? isIsraelTimezone(saved.timeZoneId) });
    }
  }, [urlProvided]);

  // Auto-detect on first visit, when nothing explicit is set (no URL param, no
  // saved location). Two-stage, best-effort, both abortable:
  //   1. IP lookup — instant, no permission, city-level approximate.
  //   2. Browser GPS — prompts the user; if granted, upgrades to a precise fix.
  // A manual choice made while these are in flight wins (locationLocked). GPS
  // locks the choice so a slower IP response can't clobber the precise fix; IP
  // does not lock, so GPS can still upgrade it. The result is persisted like any
  // location, so auto-detection runs at most once per device. The user can always
  // re-trigger GPS or search from the location picker afterwards.
  useEffect(() => {
    const saved = loadPrefs()?.location;
    // Re-detect when nothing explicit is saved — a persisted *default* doesn't count.
    if (urlProvided || (saved && !isDefaultLocation(saved))) return;
    const controller = new AbortController();

    ipGeolocate(controller.signal, localeRef.current, fallbackLabelRef.current).then((loc) => {
      if (loc && !locationLocked.current) setLocationState(loc); // soft, unlocked
    });
    browserGeolocate(fallbackLabelRef.current, localeRef.current).then((loc) => {
      if (!loc || locationLocked.current) return;
      locationLocked.current = true; // precise fix wins; a late IP can't clobber it
      setLocationState(loc);
    });

    return () => controller.abort();
  }, [urlProvided]);

  // Persist preferences whenever they change.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ location, candleLightingOffset, havdalahOpinion }));
    } catch {
      // Ignore storage errors (private mode, quota, etc.).
    }
  }, [location, candleLightingOffset, havdalahOpinion]);

  // Restore calendar state (mode + selected day) from the URL on mount, so a
  // shared link reopens the same day. Read post-mount to stay hydration-safe.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const m = p.get('m');
    const restoredMode: CalendarMode | null = m === 'hebrew' || m === 'gregorian' ? m : null;
    const d = p.get('d');
    const dt = d ? DateTime.fromISO(d) : null;
    const restoredDay = dt?.isValid ? dt.startOf('day') : null;
    if (!restoredMode && !restoredDay) return;

    // Re-anchor the viewed month to the restored day (or today) in the restored
    // mode, so a shared `?m=hebrew` link opens on the correct Hebrew month. On
    // mount the mode state is still the 'gregorian' default, so fall back to it.
    const anchorMode = restoredMode ?? 'gregorian';
    const anchorDay = restoredDay ?? DateTime.now().startOf('day');
    /* eslint-disable react-hooks/set-state-in-effect */
    if (restoredMode) setModeState(restoredMode);
    if (restoredDay) setSelectedDay(restoredDay);
    setMonthDate(monthAnchor(anchorDay, anchorMode));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Reflect mode + selected day in the URL (without a navigation) for sharing.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    p.set('m', mode);
    const iso = selectedDay.toISODate();
    if (iso) p.set('d', iso);
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }, [mode, selectedDay]);

  const toggleMode = () => setMode(mode === 'gregorian' ? 'hebrew' : 'gregorian');

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
    havdalahOpinion,
    setHavdalahOpinion,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
