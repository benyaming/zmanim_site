'use client';

import { DateTime } from 'luxon';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { type CalendarMode, DEFAULT_HIDDEN_FAST_END, monthAnchor, sanitizeHiddenFastEnd } from '@/lib/calendar';
import { type CustomDate, MAX_CUSTOM_DATES, newCustomDateId, sanitizeCustomDates } from '@/lib/custom-dates';
import { browserGeolocate } from '@/lib/geo/browser-location';
import { fetchElevation } from '@/lib/geo/elevation';
import { reverseGeocode } from '@/lib/geo/geocoding';
import { ipGeolocate } from '@/lib/geo/ip-location';
import { normalizeIsraelAreaTimezone } from '@/lib/geo/timezone';
import { sanitizeHiddenLearning } from '@/lib/learning';
import { type AppLocation, DEFAULT_LOCATION, isDefaultLocation, isIsraelTimezone, makeLocation } from '@/lib/location';
import {
  newSavedLocationId,
  resolveSavedLocation,
  sanitizeSavedLocations,
  type SavedLocation,
  savedLocationMatches,
} from '@/lib/saved-locations';
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
export type { SavedLocation };
export type { CustomDate };

export const DEFAULT_CANDLE_OFFSET = 18;
/** Candle lighting is always *before* sunset, so the offset must be ≥ 1 minute. */
export const CANDLE_OFFSET_MIN = 1;
export const CANDLE_OFFSET_MAX = 120;

interface AppStateValue {
  location: AppLocation;
  setLocation: (loc: AppLocation) => void;
  /** User-bookmarked locations, managed from the location dialog. */
  savedLocations: SavedLocation[];
  /** Bookmark a location (its `customLabel`, if any, is ignored — `name` rules). */
  addSavedLocation: (name: string, loc: AppLocation) => void;
  /** Rename a saved entry. */
  updateSavedLocation: (id: string, name: string) => void;
  removeSavedLocation: (id: string) => void;
  /** Make a saved entry the active location. */
  selectSavedLocation: (id: string) => void;
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
  /** Reset the day panel's zmanim to the everyday default set. */
  restoreDefaultZmanim: () => void;
  /** Learning-cycle keys the user chose to hide from the day panel (empty = show all). */
  hiddenLearning: string[];
  setLearningVisible: (key: string, visible: boolean) => void;
  showAllLearning: () => void;
  /** Fast-end opinion keys the user chose to hide (see fast-end.ts). */
  hiddenFastEnd: string[];
  setFastEndVisible: (key: string, visible: boolean) => void;
  showAllFastEnd: () => void;
  /** Reset the fast-end opinions to the curated default set. */
  restoreDefaultFastEnd: () => void;
  /** Personal recurring dates (birthdays, bar/bat mitzvahs, yahrzeits). */
  customDates: CustomDate[];
  /** Add an entry; a no-op once MAX_CUSTOM_DATES is reached. Returns the new id, or null if full. */
  addCustomDate: (entry: Omit<CustomDate, 'id'>) => string | null;
  updateCustomDate: (id: string, entry: Omit<CustomDate, 'id'>) => void;
  removeCustomDate: (id: string) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const STORAGE_KEY = 'zmanim:prefs:v1';

interface PersistedPrefs {
  location?: AppLocation;
  savedLocations?: SavedLocation[];
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
  /** Hidden fast-end opinions — hide-list convention; applied only when customized. */
  hiddenFastEnd?: string[];
  /** True once the user has touched the fast-end picker; only then does hiddenFastEnd override the default. */
  fastEndCustomized?: boolean;
  /** Personal recurring dates. */
  customDates?: CustomDate[];
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

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const addSavedLocation = (name: string, loc: AppLocation) => {
    const trimmed = name.trim();
    // The snapshot keeps the geocoded label as the entry's canonical name;
    // the custom name lives in `name` only.
    const entry: SavedLocation = { id: newSavedLocationId(), name: trimmed, location: { ...loc, customLabel: undefined } };
    setSavedLocations((prev) => (prev.some((e) => savedLocationMatches(e, loc)) ? prev : [...prev, entry]));
    // If the bookmarked place is the active location, show its new name in the
    // header right away. Not a location change — don't touch the lock.
    if (trimmed) {
      setLocationState((prev) =>
        prev.lat === loc.lat && prev.lng === loc.lng ? { ...prev, customLabel: trimmed } : prev,
      );
    }
  };
  const updateSavedLocation = (id: string, name: string) => {
    const trimmed = name.trim();
    const entry = savedLocations.find((e) => e.id === id);
    if (!entry) return;
    setSavedLocations((prev) => prev.map((e) => (e.id === id ? { ...e, name: trimmed } : e)));
    // Keep the active location's header name in step when it's the entry
    // being renamed, so the change shows without re-selecting it.
    setLocationState((prev) =>
      prev.lat === entry.location.lat && prev.lng === entry.location.lng
        ? { ...prev, customLabel: trimmed || undefined }
        : prev,
    );
  };
  const removeSavedLocation = (id: string) => {
    const entry = savedLocations.find((e) => e.id === id);
    setSavedLocations((prev) => prev.filter((e) => e.id !== id));
    // Un-bookmarking the active location drops its custom name (the place
    // itself stays selected).
    if (entry) {
      setLocationState((prev) =>
        prev.lat === entry.location.lat && prev.lng === entry.location.lng && prev.customLabel
          ? { ...prev, customLabel: undefined }
          : prev,
      );
    }
  };
  const selectSavedLocation = (id: string) => {
    const entry = savedLocations.find((e) => e.id === id);
    if (entry) setLocation(resolveSavedLocation(entry));
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
  const restoreDefaultZmanim = () => {
    setZmanimCustomized(true);
    setHiddenZmanim([...DEFAULT_HIDDEN_ZMANIM]);
  };
  const [hiddenLearning, setHiddenLearning] = useState<string[]>([]);
  const setLearningVisible = (key: string, visible: boolean) =>
    setHiddenLearning((prev) => {
      if (visible) return prev.includes(key) ? prev.filter((k) => k !== key) : prev;
      return prev.includes(key) ? prev : [...prev, key];
    });
  const showAllLearning = () => setHiddenLearning([]);

  // Fast-end opinions start at the curated default set (see DEFAULT_HIDDEN_FAST_END).
  // Only a persisted list from a user who actually customized it overrides the
  // default (fastEndCustomized) — so tweaks to the default reach everyone who
  // hasn't hand-picked, instead of being frozen by the eager persist.
  const [hiddenFastEnd, setHiddenFastEnd] = useState<string[]>([...DEFAULT_HIDDEN_FAST_END]);
  const [fastEndCustomized, setFastEndCustomized] = useState(false);
  const setFastEndVisible = (key: string, visible: boolean) => {
    setFastEndCustomized(true);
    setHiddenFastEnd((prev) => {
      if (visible) return prev.includes(key) ? prev.filter((k) => k !== key) : prev;
      return prev.includes(key) ? prev : [...prev, key];
    });
  };
  const showAllFastEnd = () => {
    setFastEndCustomized(true);
    setHiddenFastEnd([]);
  };
  const restoreDefaultFastEnd = () => {
    setFastEndCustomized(true);
    setHiddenFastEnd([...DEFAULT_HIDDEN_FAST_END]);
  };

  const [customDates, setCustomDates] = useState<CustomDate[]>([]);
  const addCustomDate = (entry: Omit<CustomDate, 'id'>): string | null => {
    if (customDates.length >= MAX_CUSTOM_DATES) return null;
    const id = newCustomDateId();
    setCustomDates((prev) => (prev.length >= MAX_CUSTOM_DATES ? prev : [...prev, { ...entry, id }]));
    return id;
  };
  const updateCustomDate = (id: string, entry: Omit<CustomDate, 'id'>) =>
    setCustomDates((prev) => prev.map((e) => (e.id === id ? { ...entry, id } : e)));
  const removeCustomDate = (id: string) => setCustomDates((prev) => prev.filter((e) => e.id !== id));

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
    // Fast-end default is a curated non-empty set (unlike learning's show-all),
    // so a stored list overrides it only once the user has actually customized —
    // otherwise the current default applies, so default tweaks reach them.
    if (prefs.fastEndCustomized && Array.isArray(prefs.hiddenFastEnd)) {
      setHiddenFastEnd(sanitizeHiddenFastEnd(prefs.hiddenFastEnd));
      setFastEndCustomized(true);
    }
    const savedList = sanitizeSavedLocations(prefs.savedLocations);
    if (savedList.length > 0) setSavedLocations(savedList);
    const savedCustomDates = sanitizeCustomDates(prefs.customDates);
    if (savedCustomDates.length > 0) setCustomDates(savedCustomDates);
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
          savedLocations,
          candleLightingOffset,
          useElevation,
          havdalahOpinion,
          lehumra,
          hiddenZmanim,
          zmanimCustomized,
          seenOptInZmanim: [...OPT_IN_ZMANIM],
          hiddenLearning,
          hiddenFastEnd,
          fastEndCustomized,
          customDates,
        }),
      );
    } catch {
      // Ignore storage errors (private mode, quota, etc.).
    }
  }, [location, savedLocations, candleLightingOffset, useElevation, havdalahOpinion, lehumra, hiddenZmanim, zmanimCustomized, hiddenLearning, hiddenFastEnd, fastEndCustomized, customDates]);

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
    savedLocations,
    addSavedLocation,
    updateSavedLocation,
    removeSavedLocation,
    selectSavedLocation,
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
    restoreDefaultZmanim,
    hiddenLearning,
    setLearningVisible,
    showAllLearning,
    hiddenFastEnd,
    setFastEndVisible,
    showAllFastEnd,
    restoreDefaultFastEnd,
    customDates,
    addCustomDate,
    updateCustomDate,
    removeCustomDate,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
