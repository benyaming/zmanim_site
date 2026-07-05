'use client';

import { DateTime } from 'luxon';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { type CalendarMode, monthAnchor } from '@/lib/calendar';
import { browserGeolocate } from '@/lib/geo/browser-location';
import { fetchElevation } from '@/lib/geo/elevation';
import { reverseGeocode } from '@/lib/geo/geocoding';
import { ipGeolocate } from '@/lib/geo/ip-location';
import { normalizeIsraelAreaTimezone } from '@/lib/geo/timezone';
import { sanitizeHiddenLearning } from '@/lib/learning';
import { type AppLocation, DEFAULT_LOCATION, isDefaultLocation, isIsraelTimezone, makeLocation } from '@/lib/location';
import {
  DEFAULT_HAVDALAH_OPINION,
  DEFAULT_HIDDEN_ZMANIM,
  type HavdalahOpinion,
  isHavdalahOpinion,
  OPT_IN_ZMANIM,
  sanitizeHiddenZmanim,
} from '@/lib/zmanim';

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
  /** Opt-in: factor the location's elevation into sunrise/sunset-based zmanim. */
  useElevation: boolean;
  setUseElevation: (on: boolean) => void;
  /** Which tzeit opinion determines the havdalah time. */
  havdalahOpinion: HavdalahOpinion;
  setHavdalahOpinion: (o: HavdalahOpinion) => void;
  /** Opt-in lehumra mode: round displayed times to the stringent whole minute. */
  lehumra: boolean;
  setLehumra: (on: boolean) => void;
  /** Zman keys the user chose to hide from the day panel (empty = show all). */
  hiddenZmanim: string[];
  setZmanVisible: (key: string, visible: boolean) => void;
  showAllZmanim: () => void;
  /** Learning-cycle keys the user chose to hide from the day panel (empty = show all). */
  hiddenLearning: string[];
  setLearningVisible: (key: string, visible: boolean) => void;
  showAllLearning: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const STORAGE_KEY = 'zmanim:prefs:v1';

interface PersistedPrefs {
  location?: AppLocation;
  candleLightingOffset?: number;
  /** Opt-in elevation-adjusted zmanim; absent/false = standard sea-level times. */
  useElevation?: boolean;
  havdalahOpinion?: HavdalahOpinion;
  /** Opt-in stringent minute rounding; absent/false = exact times. */
  lehumra?: boolean;
  /** Hidden (not visible) keys, so zmanim added later default to shown. */
  hiddenZmanim?: string[];
  /**
   * True once the user has touched zmanim visibility. Only then does the
   * persisted hide list override DEFAULT_HIDDEN_ZMANIM — it distinguishes an
   * explicit "show all" (empty list, customized) from a never-opened picker
   * (empty-or-default list, not customized), which should track the app
   * default across releases.
   */
  zmanimCustomized?: boolean;
  /**
   * Opt-in zman keys this save has already encountered. An opt-in zman (e.g.
   * the astronomical hour) missing from this list starts hidden even for a
   * customized hide list — once — instead of defaulting to shown like other
   * newly added zmanim.
   */
  seenOptInZmanim?: string[];
  /** Hidden learning cycles — same hide-list convention as hiddenZmanim. */
  hiddenLearning?: string[];
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
    initialLocation ?? { ...DEFAULT_LOCATION, label: tLocation('defaultCity'), labelLocale: locale },
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
    // Functional update so the anchor always uses the latest monthDate, even if
    // setMode fires alongside other setMonthDate updates before a re-render.
    setMonthDate((prev) => monthAnchor(prev, m));
  };
  const [candleLightingOffset, setCandleLightingOffset] = useState(DEFAULT_CANDLE_OFFSET);
  const [useElevation, setUseElevation] = useState(false);
  const [havdalahOpinion, setHavdalahOpinion] = useState<HavdalahOpinion>(DEFAULT_HAVDALAH_OPINION);
  const [lehumra, setLehumra] = useState(false);
  const [hiddenZmanim, setHiddenZmanim] = useState<string[]>([...DEFAULT_HIDDEN_ZMANIM]);
  const [zmanimCustomized, setZmanimCustomized] = useState(false);
  const setZmanVisible = (key: string, visible: boolean) => {
    setZmanimCustomized(true);
    setHiddenZmanim((prev) => {
      if (visible) return prev.includes(key) ? prev.filter((k) => k !== key) : prev;
      return prev.includes(key) ? prev : [...prev, key];
    });
  };
  const showAllZmanim = () => {
    setZmanimCustomized(true);
    setHiddenZmanim([]);
  };
  const [hiddenLearning, setHiddenLearning] = useState<string[]>([]);
  const setLearningVisible = (key: string, visible: boolean) =>
    setHiddenLearning((prev) => {
      if (visible) return prev.includes(key) ? prev.filter((k) => k !== key) : prev;
      return prev.includes(key) ? prev : [...prev, key];
    });
  const showAllLearning = () => setHiddenLearning([]);

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
    if (prefs.useElevation === true) setUseElevation(true);
    if (isHavdalahOpinion(prefs.havdalahOpinion)) setHavdalahOpinion(prefs.havdalahOpinion);
    if (prefs.lehumra === true) setLehumra(true);
    // Unknown/stale keys are dropped, so a save from an old version self-heals.
    // The saved hide list only overrides the default set when it's an explicit
    // choice (zmanimCustomized). Legacy saves predate the flag: there a
    // non-empty list was deliberate, while an empty one just mirrored the old
    // show-everything default — those users move to the current default.
    const savedHidden = sanitizeHiddenZmanim(prefs.hiddenZmanim);
    if (prefs.zmanimCustomized ?? savedHidden.length > 0) {
      // Opt-in zmanim this save has never seen start hidden here too — for
      // them the new-zmanim-default-to-shown convention is deliberately
      // reversed, once per key (the persist below records them as seen).
      const seen = new Set(Array.isArray(prefs.seenOptInZmanim) ? prefs.seenOptInZmanim : []);
      const unseenOptIn = OPT_IN_ZMANIM.filter((k) => !seen.has(k));
      setHiddenZmanim([...new Set([...savedHidden, ...unseenOptIn])]);
      setZmanimCustomized(true);
    }
    const savedHiddenLearning = sanitizeHiddenLearning(prefs.hiddenLearning);
    if (savedHiddenLearning.length > 0) setHiddenLearning(savedHiddenLearning);
    // A location from the URL (deep link) takes precedence over the saved one.
    // Ignore a persisted *default* (eager-persisted, not a real choice) so it
    // doesn't lock out auto-detection. inIsrael is always derived from the
    // timezone, so recompute it on load — this backfills locations persisted
    // before the field existed and heals ones saved with a stale `false` when
    // Asia/Hebron wasn't yet recognized as Israel. The timezone itself is
    // re-normalized for the same legacy saves (see normalizeIsraelAreaTimezone).
    if (!urlProvided && prefs.location && !isDefaultLocation(prefs.location)) {
      const saved = prefs.location;
      locationLocked.current = true; // a saved location is an explicit choice
      const timeZoneId = normalizeIsraelAreaTimezone(saved.timeZoneId);
      setLocationState({ ...saved, timeZoneId, inIsrael: isIsraelTimezone(timeZoneId) });
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

  // Re-resolve the location label when the UI language changes: a saved label
  // keeps the locale it was resolved in (e.g. "Петах-Тиква" after switching to
  // English), and older saves carry no labelLocale at all — both re-resolve
  // here. Deep-link labels are respected verbatim for the session, and the
  // default's label is already translated at init.
  useEffect(() => {
    if (urlProvided) return;
    const loc = location;
    if (isDefaultLocation(loc) || loc.labelLocale === locale) return;
    const controller = new AbortController();
    reverseGeocode(loc.lat, loc.lng, controller.signal, locale)
      .then((name) => {
        if (!name) return;
        // Patch only if the location hasn't changed meanwhile, and without
        // locking — renaming isn't a location choice.
        setLocationState((prev) =>
          prev.lat === loc.lat && prev.lng === loc.lng ? { ...prev, label: name, labelLocale: locale } : prev,
        );
      })
      .catch(() => {
        // Best-effort: keep the stale label; the next mount retries.
      });
    return () => controller.abort();
  }, [location, locale, urlProvided]);

  // Backfill elevation for locations that arrived without one (GPS/IP fixes,
  // settlement picks, deep links, saves that predate the field). Best-effort
  // and patch-only — like the relabel effect it must not lock the location,
  // and it only applies if the coordinates haven't changed meanwhile. Runs at
  // most once per location since a successful patch persists the value.
  useEffect(() => {
    const loc = location;
    if (typeof loc.elevation === 'number') return;
    const controller = new AbortController();
    fetchElevation(loc.lat, loc.lng, controller.signal)
      .then((elevation) => {
        if (elevation == null) return;
        setLocationState((prev) => (prev.lat === loc.lat && prev.lng === loc.lng ? { ...prev, elevation } : prev));
      })
      .catch(() => {
        // Aborted (location changed / unmount) — the next run retries.
      });
    return () => controller.abort();
  }, [location]);

  // Persist preferences whenever they change.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          location,
          candleLightingOffset,
          useElevation,
          havdalahOpinion,
          lehumra,
          hiddenZmanim,
          zmanimCustomized,
          seenOptInZmanim: [...OPT_IN_ZMANIM],
          hiddenLearning,
        }),
      );
    } catch {
      // Ignore storage errors (private mode, quota, etc.).
    }
  }, [location, candleLightingOffset, useElevation, havdalahOpinion, lehumra, hiddenZmanim, zmanimCustomized, hiddenLearning]);

  // Restore calendar state (mode + selected day + viewed month) from the URL on
  // mount, so a shared link reopens the same view. Read post-mount to stay
  // hydration-safe.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const m = p.get('m');
    const restoredMode: CalendarMode | null = m === 'hebrew' || m === 'gregorian' ? m : null;
    const d = p.get('d');
    const dt = d ? DateTime.fromISO(d) : null;
    const restoredDay = dt?.isValid ? dt.startOf('day') : null;
    // The viewed month can differ from the selected day's month (the user
    // browsed away) — it's carried separately so a reload keeps the view.
    const v = p.get('v');
    const vt = v ? DateTime.fromISO(v) : null;
    const restoredView = vt?.isValid ? vt.startOf('day') : null;
    if (!restoredMode && !restoredDay && !restoredView) return;

    // Re-anchor the viewed month in the restored mode, so a shared `?m=hebrew`
    // link opens on the correct Hebrew month. Older links have no `v` — fall
    // back to the restored day (or today). On mount the mode state is still
    // the 'gregorian' default, so fall back to it.
    const anchorMode = restoredMode ?? 'gregorian';
    const anchorDay = restoredView ?? restoredDay ?? DateTime.now().startOf('day');
    /* eslint-disable react-hooks/set-state-in-effect */
    if (restoredMode) setModeState(restoredMode);
    if (restoredDay) setSelectedDay(restoredDay);
    setMonthDate(monthAnchor(anchorDay, anchorMode));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Reflect mode + selected day + viewed month in the URL (without a
  // navigation) for sharing and reloads.
  const reflectedOnce = useRef(false);
  useEffect(() => {
    // Skip the mount run: it fires before the URL-restore effect's setStates
    // have re-rendered, so it would overwrite the very params restore just
    // read with the initial (today) state. That clobber broke locale
    // switching — the switch remounts this provider, and the re-read URL had
    // already been reset to today. Any state change re-runs this with fresh
    // values; until then the URL already says what the state says.
    if (!reflectedOnce.current) {
      reflectedOnce.current = true;
      return;
    }
    const p = new URLSearchParams(window.location.search);
    p.set('m', mode);
    const iso = selectedDay.toISODate();
    if (iso) p.set('d', iso);
    const view = monthDate.toISODate();
    if (view) p.set('v', view);
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }, [mode, selectedDay, monthDate]);

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
    useElevation,
    setUseElevation,
    havdalahOpinion,
    setHavdalahOpinion,
    lehumra,
    setLehumra,
    hiddenZmanim,
    setZmanVisible,
    showAllZmanim,
    hiddenLearning,
    setLearningVisible,
    showAllLearning,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
