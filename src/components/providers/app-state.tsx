'use client';

import { DateTime } from 'luxon';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { type CalendarMode, DEFAULT_HIDDEN_FAST_END, monthAnchor, sanitizeHiddenFastEnd } from '@/lib/calendar';
import {
  EMPTY_PERSONAL_DATES,
  type Gender,
  MAX_EVENTS_PER_PERSON,
  MAX_OCCASIONS,
  MAX_PEOPLE,
  migrateLegacyCustomDates,
  newId,
  type Person,
  type PersonalDatesData,
  type PersonEvent,
  sanitizePersonalDates,
  SINGLE_EVENT_KINDS,
  type StandaloneDate,
} from '@/lib/personal-dates';
// Straight from the module, not the `@/lib/export` barrel: that barrel also
// re-exports the writers (PDF rasterizer, workbook builder), and this provider
// is in the main bundle — nothing here should be able to drag those in.
import { type ExportPreset, sanitizeExportPreset } from '@/lib/export/preset';
import { browserGeolocate } from '@/lib/geo/browser-location';
import { fetchElevation } from '@/lib/geo/elevation';
import { reverseGeocode } from '@/lib/geo/geocoding';
import { ipGeolocate } from '@/lib/geo/ip-location';
import { normalizeIsraelAreaTimezone } from '@/lib/geo/timezone';
import { sanitizeHiddenLearning } from '@/lib/learning';
import { type AppLocation, DEFAULT_LOCATION, isDefaultLocation, isIsraelTimezone, makeLocation } from '@/lib/location';
import { isTelegramMiniApp } from '@/lib/telegram/mini-app';
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
export type { Person, PersonalDatesData, PersonEvent, StandaloneDate };

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
  /**
   * Apply the bot-side profile when running as a Telegram Mini App. Each value
   * lands only if the user hasn't explicitly changed it this session, so a
   * slow profile response can't undo a fresh in-app choice (see the
   * TelegramMiniApp provider component). `botLocations` always applies — it's
   * a display list, not a choice.
   */
  applyBotProfile: (profile: {
    location?: AppLocation;
    candleLightingOffset?: number;
    havdalahOpinion?: HavdalahOpinion;
    botLocations?: SavedLocation[];
  }) => void;
  /**
   * Locations saved in the companion Telegram bot (mini app only, empty
   * elsewhere). Shown alongside the local bookmarks but managed in the bot —
   * not persisted here and not editable from the picker.
   */
  botLocations: SavedLocation[];
  /** Personal dates: people (with their events) and standalone occasions. */
  personalDates: PersonalDatesData;
  /** Add a person; a no-op once MAX_PEOPLE is reached. Returns the new id, or null if full. */
  addPerson: (input: { name: string; gender?: Gender }) => string | null;
  updatePerson: (id: string, patch: { name?: string; gender?: Gender }) => void;
  removePerson: (id: string) => void;
  /** Append an event to a person; a no-op once the person has MAX_EVENTS_PER_PERSON. */
  addPersonEvent: (personId: string, event: Omit<PersonEvent, 'id'>) => void;
  updatePersonEvent: (personId: string, eventId: string, event: Omit<PersonEvent, 'id'>) => void;
  removePersonEvent: (personId: string, eventId: string) => void;
  /** Add a standalone occasion; a no-op once MAX_OCCASIONS is reached. Returns the new id, or null if full. */
  addOccasion: (occasion: Omit<StandaloneDate, 'id'>) => string | null;
  updateOccasion: (id: string, occasion: Omit<StandaloneDate, 'id'>) => void;
  removeOccasion: (id: string) => void;
  /**
   * The zmanim table export's last-used selection, or null on a device that has
   * never exported one — where the tool falls back to its live defaults rather
   * than a frozen copy of them.
   */
  exportPreset: ExportPreset | null;
  /** Remember this selection as the last export. Called when an export succeeds. */
  setExportPreset: (preset: ExportPreset) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

/** localStorage key for the persisted prefs — read by the settings-sync blob too. */
export const PREFS_STORAGE_KEY = 'zmanim:prefs:v1';
const STORAGE_KEY = PREFS_STORAGE_KEY;

interface PersistedPrefs {
  location?: AppLocation;
  savedLocations?: SavedLocation[];
  candleLightingOffset?: number;
  /** Opt-in elevation-adjusted zmanim; absent/false = standard sea-level times. */
  useElevation?: boolean;
  havdalahOpinion?: HavdalahOpinion;
  /** Opt-in stringent minute rounding; absent/false = exact times. */
  lehumra?: boolean;
  /**
   * True once the user has touched the lehumra toggle themselves. Only then
   * does a stored `false` survive in the Telegram Mini App, where lehumra
   * defaults ON (the bot always rounds lehumra, and the mini app mirrors it).
   */
  lehumraCustomized?: boolean;
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
  /** Personal dates: people + occasions. */
  personalDates?: PersonalDatesData;
  /** Legacy flat personal-date list — migrated into `personalDates` on load. */
  customDates?: unknown;
  /** The zmanim-table export's last-used selection (see lib/export/preset.ts). */
  export?: unknown;
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
  // A deep-link location (?lat=&lng= — a shared link, or the bot's personalized
  // launch URL inside Telegram, which carries the bot's coordinates on every
  // open) is a view for this session, not a choice: it is shown but never
  // persisted. Persisting it overwrote the saved location in prefs at every
  // Mini App mount, keeping this device permanently diverged from the synced
  // blob — so the startup reconcile adopted the blob and reloaded on every
  // launch (each launch is a fresh webview session, so the one-reload-per-
  // session cap reset every time). While the flag holds, the persist effect
  // writes storedLocation — whatever location prefs held at load, verbatim, so
  // the persisted content round-trips unchanged. An explicit in-session pick
  // clears it.
  const deepLinkSessionOnly = useRef(urlProvided);
  const storedLocation = useRef<AppLocation | null>(null);
  // What the user explicitly changed *this session* — the Telegram bot profile
  // must not override these (unlike locationLocked, a restored save or URL
  // param doesn't count: the bot profile is fresher than both). Location isn't
  // tracked here: the bot's copy never overrides a device that has one at all,
  // which locationLocked already answers.
  const sessionTouched = useRef({ candleOffset: false, havdalah: false });
  const setLocation = (loc: AppLocation) => {
    locationLocked.current = true;
    deepLinkSessionOnly.current = false;
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
  const [candleLightingOffset, setCandleLightingOffsetState] = useState(DEFAULT_CANDLE_OFFSET);
  const setCandleLightingOffset = (m: number) => {
    sessionTouched.current.candleOffset = true;
    setCandleLightingOffsetState(m);
  };
  const [useElevation, setUseElevation] = useState(false);
  const [havdalahOpinion, setHavdalahOpinionState] = useState<HavdalahOpinion>(DEFAULT_HAVDALAH_OPINION);
  const setHavdalahOpinion = (o: HavdalahOpinion) => {
    sessionTouched.current.havdalah = true;
    setHavdalahOpinionState(o);
  };

  // Telegram Mini App: mirror the bot-side profile (see the interface doc).
  // The location counts as an explicit choice (locked against the IP
  // soft-default) but not as a session touch, so the relabel/elevation
  // effects may still patch it.
  const [botLocations, setBotLocations] = useState<SavedLocation[]>([]);
  const applyBotProfile = (profile: {
    location?: AppLocation;
    candleLightingOffset?: number;
    havdalahOpinion?: HavdalahOpinion;
    botLocations?: SavedLocation[];
  }) => {
    // The bot's location SEEDS a device that has none of its own; it never
    // overrides one. `locationLocked` is exactly that test — a URL deep link, a
    // restored non-default pref, a precise fix, or a pick made here. Re-applying
    // it on every launch used to undo a location chosen in the app (and rewrote
    // prefs each mount, which drove the settings reconcile into a reload loop).
    // The reverse direction is gone too: the app never writes the bot's
    // location back (see TelegramMiniApp).
    if (profile.location && !locationLocked.current) {
      locationLocked.current = true;
      setLocationState(profile.location);
    }
    if (profile.candleLightingOffset !== undefined && !sessionTouched.current.candleOffset) {
      setCandleLightingOffsetState(profile.candleLightingOffset);
    }
    if (profile.havdalahOpinion !== undefined && !sessionTouched.current.havdalah) {
      setHavdalahOpinionState(profile.havdalahOpinion);
    }
    // Keep the previous array when the content is unchanged. Every profile
    // fetch builds a fresh array for the same list, and swapping it in
    // re-rendered the provider for nothing — WebBotProfile's pull effect
    // (keyed on this function's identity) then re-fired, fetched the profile
    // again, and applied it again: a fetch loop at network speed that flooded
    // the bot API with /me calls for as long as a signed-in tab stayed open.
    if (profile.botLocations) {
      const next = profile.botLocations;
      setBotLocations((prev) =>
        prev.length === next.length && prev.every((e, i) => e.id === next[i].id && e.name === next[i].name)
          ? prev
          : next,
      );
    }
  };
  const [lehumra, setLehumraState] = useState(false);
  const [lehumraCustomized, setLehumraCustomized] = useState(false);
  const setLehumra = (on: boolean) => {
    setLehumraCustomized(true);
    setLehumraState(on);
  };
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

  const [personalDates, setPersonalDates] = useState<PersonalDatesData>(EMPTY_PERSONAL_DATES);
  const mapPerson = (id: string, fn: (p: Person) => Person) =>
    setPersonalDates((prev) => ({ ...prev, people: prev.people.map((p) => (p.id === id ? fn(p) : p)) }));

  const addPerson = ({ name, gender }: { name: string; gender?: Gender }): string | null => {
    if (personalDates.people.length >= MAX_PEOPLE) return null;
    const id = newId();
    setPersonalDates((prev) =>
      prev.people.length >= MAX_PEOPLE ? prev : { ...prev, people: [...prev.people, { id, name, gender, events: [] }] },
    );
    return id;
  };
  const updatePerson = (id: string, patch: { name?: string; gender?: Gender }) =>
    mapPerson(id, (p) => ({ ...p, ...patch }));
  const removePerson = (id: string) =>
    setPersonalDates((prev) => ({ ...prev, people: prev.people.filter((p) => p.id !== id) }));

  // A person is born once and passes once — reject a second birth/death.
  const hasKind = (p: Person, kind: PersonEvent['kind'], exceptId?: string) =>
    SINGLE_EVENT_KINDS.includes(kind) && p.events.some((e) => e.kind === kind && e.id !== exceptId);
  const addPersonEvent = (personId: string, event: Omit<PersonEvent, 'id'>) =>
    mapPerson(personId, (p) =>
      p.events.length >= MAX_EVENTS_PER_PERSON || hasKind(p, event.kind)
        ? p
        : { ...p, events: [...p.events, { ...event, id: newId() }] },
    );
  const updatePersonEvent = (personId: string, eventId: string, event: Omit<PersonEvent, 'id'>) =>
    mapPerson(personId, (p) =>
      hasKind(p, event.kind, eventId)
        ? p
        : { ...p, events: p.events.map((e) => (e.id === eventId ? { ...event, id: eventId } : e)) },
    );
  const removePersonEvent = (personId: string, eventId: string) =>
    mapPerson(personId, (p) => ({ ...p, events: p.events.filter((e) => e.id !== eventId) }));

  const addOccasion = (occasion: Omit<StandaloneDate, 'id'>): string | null => {
    if (personalDates.occasions.length >= MAX_OCCASIONS) return null;
    const id = newId();
    setPersonalDates((prev) =>
      prev.occasions.length >= MAX_OCCASIONS ? prev : { ...prev, occasions: [...prev.occasions, { ...occasion, id }] },
    );
    return id;
  };
  const updateOccasion = (id: string, occasion: Omit<StandaloneDate, 'id'>) =>
    setPersonalDates((prev) => ({ ...prev, occasions: prev.occasions.map((o) => (o.id === id ? { ...occasion, id } : o)) }));
  const removeOccasion = (id: string) =>
    setPersonalDates((prev) => ({ ...prev, occasions: prev.occasions.filter((o) => o.id !== id) }));

  const [exportPreset, setExportPreset] = useState<ExportPreset | null>(null);

  // Gates persistence: it flips true only after the load effect has read
  // localStorage, so a pre-hydration render (initial mount, an HMR remount, or
  // React StrictMode's double-invoke) can never overwrite saved prefs with the
  // component's empty defaults.
  const [hydrated, setHydrated] = useState(false);

  // Load saved preferences once after mount. Done in an effect (not the initial
  // render) so server and client first-render agree — avoids hydration drift.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    const prefs = loadPrefs();
    if (!prefs) return;
    // Apply a saved offset only if it's a sane value; otherwise keep the default
    // (this also heals a previously-persisted 0, which is invalid for candle lighting).
    const savedOffset = prefs.candleLightingOffset;
    if (typeof savedOffset === 'number' && Number.isFinite(savedOffset) && savedOffset >= CANDLE_OFFSET_MIN) {
       
      setCandleLightingOffsetState(Math.min(CANDLE_OFFSET_MAX, Math.round(savedOffset)));
    }
    if (prefs.useElevation === true) setUseElevation(true);
    if (isHavdalahOpinion(prefs.havdalahOpinion)) setHavdalahOpinionState(prefs.havdalahOpinion);
    if (prefs.lehumra === true) setLehumraState(true);
    if (prefs.lehumraCustomized === true) setLehumraCustomized(true);
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
    // Prefer the new shape; migrate the legacy flat list once when it's absent.
    const savedPersonal = prefs.personalDates
      ? sanitizePersonalDates(prefs.personalDates)
      : migrateLegacyCustomDates(prefs.customDates);
    if (savedPersonal.people.length > 0 || savedPersonal.occasions.length > 0) setPersonalDates(savedPersonal);
    // Unrecognized or stale content sanitizes to null, which reads as "never
    // exported" — the tool then uses its live defaults instead of a stale copy.
    const savedExport = sanitizeExportPreset(prefs.export);
    if (savedExport) setExportPreset(savedExport);
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
    // Under a deep link the saved location still owns the persisted copy —
    // stashed verbatim (no normalization) so the persist effect round-trips
    // the synced content byte-for-byte.
    if (urlProvided && prefs.location) storedLocation.current = prefs.location;
  }, [urlProvided]);

  // Telegram Mini App: the zmanim mirror the bot, and the bot always rounds
  // lehumra — so lehumra defaults ON there. An explicit user choice
  // (lehumraCustomized, persisted) wins; a plain persisted `false` is just
  // the eager first-visit save, not a choice.
  useEffect(() => {
    if (!isTelegramMiniApp()) return;
    if (loadPrefs()?.lehumraCustomized) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLehumraState(true);
  }, []);

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
    // Inside Telegram's webview the GPS permission flow is unreliable (iOS
    // never prompts) and the bot profile is the better source — keep the soft
    // IP guess but don't auto-prompt; the location dialog's GPS button still
    // works on demand.
    if (!isTelegramMiniApp()) {
      browserGeolocate(fallbackLabelRef.current, localeRef.current).then((loc) => {
        if (!loc || locationLocked.current) return;
        locationLocked.current = true; // precise fix wins; a late IP can't clobber it
        setLocationState(loc);
      });
    }

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
  // locality picks, deep links, saves that predate the field). Best-effort
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

  // Persist preferences whenever they change — but never before the load effect
  // has hydrated state from localStorage, or the first render's empty defaults
  // would clobber the saved prefs.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          // A session-only deep link never lands in prefs — the saved location
          // (or none) rides through untouched.
          location: deepLinkSessionOnly.current ? (storedLocation.current ?? undefined) : location,
          savedLocations,
          candleLightingOffset,
          useElevation,
          havdalahOpinion,
          lehumra,
          lehumraCustomized,
          hiddenZmanim,
          zmanimCustomized,
          seenOptInZmanim: [...OPT_IN_ZMANIM],
          hiddenLearning,
          hiddenFastEnd,
          fastEndCustomized,
          personalDates,
          // Omitted entirely until an export has actually been made, so a device
          // that never used the tool doesn't push an empty object at sync.
          ...(exportPreset ? { export: exportPreset } : {}),
        }),
      );
    } catch {
      // Ignore storage errors (private mode, quota, etc.).
    }
  }, [hydrated, location, savedLocations, candleLightingOffset, useElevation, havdalahOpinion, lehumra, lehumraCustomized, hiddenZmanim, zmanimCustomized, hiddenLearning, hiddenFastEnd, fastEndCustomized, personalDates, exportPreset]);

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
    applyBotProfile,
    botLocations,
    personalDates,
    addPerson,
    updatePerson,
    removePerson,
    addPersonEvent,
    updatePersonEvent,
    removePersonEvent,
    addOccasion,
    updateOccasion,
    removeOccasion,
    exportPreset,
    setExportPreset,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
