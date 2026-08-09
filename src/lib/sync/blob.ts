/**
 * The portable settings snapshot ("blob") — everything configurable the app
 * persists on a device, packaged for sync and transfer (see
 * docs/settings-sync.md).
 *
 * The blob is split into independent **sections** (prefs, accessibility,
 * theme, language), each carrying its OWN timestamp. Reconcile merges
 * section-by-section, newest wins per section — so changing the theme on one
 * device can't revert the language set on another. (Whole-blob last-write-wins
 * did exactly that, which is the bug this shape fixes.)
 *
 * The blob stays opaque to every store that holds it (Telegram CloudStorage,
 * the bot's Mongo — `web_prefs` for Telegram accounts, `web_sync` for Google
 * ones — and a link/file export): stores keep the bytes
 * and never model the sections. Content validation stays where it always was —
 * the providers sanitize what they load from localStorage — so applying a
 * section is just writing its raw data back to the same key.
 */

import { DEFAULT_CANDLE_OFFSET, PREFS_STORAGE_KEY } from '@/components/providers/app-state';
import { A11Y_STORAGE_KEY } from '@/components/providers/accessibility-provider';
import { DEFAULT_HIDDEN_FAST_END } from '@/lib/calendar';
import { DEFAULT_LOCATION } from '@/lib/location';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { DEFAULT_HAVDALAH_OPINION, DEFAULT_HIDDEN_ZMANIM } from '@/lib/zmanim';

/** UI languages that may ride in the blob (the app's routing locales). */
const LANGUAGES = ['en', 'he', 'ru'];

/** The independently-synced sections. Order is stable for iteration. */
export const SECTION_NAMES = ['prefs', 'a11y', 'theme', 'language'] as const;
export type SectionName = (typeof SECTION_NAMES)[number];

/** prefs/a11y hold an object (or null); theme/language a string (or null). */
export type SectionData = Record<string, unknown> | string | null;

export interface BlobSection {
  data: SectionData;
  /** ISO instant this section last genuinely changed on some device. */
  t: string;
}

export interface SettingsBlob {
  v: 2;
  sections: Record<SectionName, BlobSection>;
}

/**
 * A pull that couldn't read the store (network/HTTP error) — distinct from a
 * pull that read it and found nothing (`null`). The reconcile must NOT push
 * over a store whose contents it couldn't read, or a transient read failure on
 * a fresh device would overwrite good remote settings with local defaults.
 */
export const PULL_FAILED = Symbol('pull-failed');

/** A target's pull result: the blob, `null` (definitively empty), or a read failure. */
export type PullResult = SettingsBlob | null | typeof PULL_FAILED;

/** Per-section change stamps: { prefs?, a11y?, theme?, language? } (ISO). */
const META_KEY = 'zmanim:sync-meta:v1';
/** The prefs fingerprint this device last agreed on (gates the prefs watcher). */
const SYNCED_KEY = 'zmanim:sync-synced:v1';
/** The highest stamp this device has ever seen — the Lamport clock (ms). */
const CLOCK_KEY = 'zmanim:sync-clock:v1';
/** Sections the user edited locally that aren't confirmed pushed yet. */
const DIRTY_KEY = 'zmanim:sync-dirty:v1';
/** Which account each store last reconciled with (target id → account id). */
const LINEAGE_KEY = 'zmanim:sync-lineage:v1';

/** A section never explicitly changed dates to the epoch, so any real edit wins. */
const EPOCH = new Date(0).toISOString();

/**
 * Upper bound for a serialized blob. Far above any real save (50 custom dates
 * and a full hide list stay under ~20k) — it only guards stores and imports
 * against garbage. The bot API enforces the same cap server-side.
 */
export const MAX_BLOB_CHARS = 65536;

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson(key: string): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readTheme(): string | null {
  try {
    const t = window.localStorage.getItem(THEME_STORAGE_KEY);
    return t === 'light' || t === 'dark' || t === 'system' ? t : null;
  } catch {
    return null;
  }
}

function readLanguage(): string | null {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : '';
  return LANGUAGES.includes(lang) ? lang : null;
}

function sectionStamps(): Record<string, string> {
  const meta = readJson(META_KEY) ?? {};
  const out: Record<string, string> = {};
  for (const name of SECTION_NAMES) {
    const at = meta[name];
    if (typeof at === 'string' && !Number.isNaN(Date.parse(at))) out[name] = at;
  }
  return out;
}

function readClock(): number {
  const raw = Number(readRaw(CLOCK_KEY));
  return Number.isFinite(raw) ? raw : 0;
}

function writeClock(ms: number): void {
  try {
    window.localStorage.setItem(CLOCK_KEY, String(ms));
  } catch {
    // Ignore storage errors — worst case a stamp isn't strictly monotonic.
  }
}

/**
 * Record the highest timestamp this device has seen, from any blob it pulled
 * or holds — the Lamport clock. A later local change is stamped strictly above
 * this (see nextStamp), so it beats everything already in the system even when
 * another device's wall clock runs ahead (cross-device clock skew would
 * otherwise let a stale value with a larger timestamp win forever).
 */
export function observeStamps(stamps: string[]): void {
  let max = readClock();
  for (const s of stamps) {
    const ms = Date.parse(s);
    if (Number.isFinite(ms) && ms > max) max = ms;
  }
  writeClock(max);
}

/** The next monotonic stamp: strictly greater than anything seen or issued. */
function nextStamp(): string {
  const ms = Math.max(Date.now(), readClock() + 1);
  writeClock(ms);
  return new Date(ms).toISOString();
}

/**
 * Stamp one section as changed. With no explicit `at` the stamp is the next
 * Lamport tick (beats every stamp seen so far); adoption passes the adopted
 * section's own stamp (and clears the dirty flag, since the remote supersedes
 * the local edit). Returns the stamp used.
 */
export function stampSection(name: SectionName, at?: string): string {
  const isAdoption = at !== undefined;
  const stamp = at ?? nextStamp();
  try {
    const meta = readJson(META_KEY) ?? {};
    meta[name] = stamp;
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage errors (private mode, quota, etc.).
  }
  if (isAdoption) clearDirty([name]);
  return stamp;
}

/**
 * Stamp a section the user just changed AND flag it dirty. On the next sync,
 * after remote stamps are observed, the reconcile re-stamps dirty sections
 * above them — so an explicit edit wins even if this device hadn't yet seen a
 * newer remote value (or another device's clock runs ahead). Used by the
 * theme/a11y/language controls; prefs uses the plain watcher path.
 */
export function markUserEdit(name: SectionName): string {
  const dirty = new Set(dirtySections());
  dirty.add(name);
  writeDirty([...dirty]);
  return stampSection(name);
}

function writeDirty(names: SectionName[]): void {
  try {
    window.localStorage.setItem(DIRTY_KEY, JSON.stringify(names));
  } catch {
    // Ignore storage errors.
  }
}

export function dirtySections(): SectionName[] {
  try {
    const raw: unknown = JSON.parse(readRaw(DIRTY_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((n): n is SectionName => SECTION_NAMES.includes(n as SectionName)) : [];
  } catch {
    return [];
  }
}

export function clearDirty(names: SectionName[]): void {
  const remaining = dirtySections().filter((n) => !names.includes(n));
  writeDirty(remaining);
}

/**
 * Re-stamp every dirty section above the current (post-observe) clock and
 * return the sections and their new stamps, so the caller's merge lets the
 * local edit win. Call after observeStamps, before merging.
 */
export function restampDirtySections(): { name: SectionName; t: string }[] {
  return dirtySections().map((name) => ({ name, t: stampSection(name) }));
}

/**
 * Whether a prefs section holds things the user would miss, judged by CONTENT
 * — the stamp-based history check alone misses devices whose prefs predate the
 * sync metadata (v1.22): they can carry custom dates and real customizations
 * with no stamp at all, and must not be silently overwritten on connect. The
 * mount-time defaults every fresh device writes come back false. The field
 * list is best-effort; a field not listed errs toward "pristine" (the account
 * wins silently, today's behavior for fresh devices).
 */
export function prefsHoldUserData(data: SectionData): boolean {
  if (data === null || typeof data !== 'object') return false;
  const prefs = data as Record<string, unknown>;
  const personal = prefs.personalDates as { people?: unknown[]; occasions?: unknown[] } | undefined;
  if ((personal?.people?.length ?? 0) > 0 || (personal?.occasions?.length ?? 0) > 0) return true;
  if (Array.isArray(prefs.customDates) && prefs.customDates.length > 0) return true; // pre-1.23 shape
  if (Array.isArray(prefs.savedLocations) && prefs.savedLocations.length > 0) return true;
  if (prefs.zmanimCustomized === true || prefs.lehumraCustomized === true || prefs.fastEndCustomized === true) {
    return true;
  }
  // An export preset exists only after a real export — the prefs writer omits
  // the key until then — so its presence is deliberate, never a mount default.
  if (prefs.export !== undefined) return true;
  // Deliberate on the web, where this check runs (default off there; the Mini
  // App defaults it on, but Mini App stores never take the content path).
  // Covers devices that enabled it before the lehumraCustomized marker existed.
  if (prefs.lehumra === true) return true;
  if (typeof prefs.candleLightingOffset === 'number' && prefs.candleLightingOffset !== DEFAULT_CANDLE_OFFSET) {
    return true;
  }
  if (prefs.useElevation === true) return true;
  if (typeof prefs.havdalahOpinion === 'string' && prefs.havdalahOpinion !== DEFAULT_HAVDALAH_OPINION) return true;
  // Pre-flag-era devices customized these lists without a *Customized marker.
  const differsFromDefault = (value: unknown, defaults: readonly string[]): boolean =>
    Array.isArray(value) && [...value].sort().join('\n') !== [...defaults].sort().join('\n');
  if (differsFromDefault(prefs.hiddenZmanim, DEFAULT_HIDDEN_ZMANIM)) return true;
  if (Array.isArray(prefs.hiddenLearning) && prefs.hiddenLearning.length > 0) return true;
  if (differsFromDefault(prefs.hiddenFastEnd, DEFAULT_HIDDEN_FAST_END)) return true;
  const location = prefs.location as { lat?: unknown; lng?: unknown } | undefined;
  if (
    typeof location?.lat === 'number' &&
    typeof location.lng === 'number' &&
    (location.lat !== DEFAULT_LOCATION.lat || location.lng !== DEFAULT_LOCATION.lng)
  ) {
    return true;
  }
  return false;
}

/**
 * Whether an a11y section holds deliberate choices. The accessibility provider
 * writes its DEFAULTS to localStorage on every mount, so presence alone means
 * nothing — only a non-default value does. Mirrors prefsHoldUserData for
 * pre-v1.22 devices whose choices carry no sync stamp.
 */
export function a11yHoldsUserData(data: SectionData): boolean {
  if (data === null || typeof data !== 'object') return false;
  const a11y = data as Record<string, unknown>;
  return (
    (typeof a11y.fontScale === 'string' && a11y.fontScale !== 'default') ||
    a11y.reduceMotion === true ||
    a11y.highContrast === true
  );
}

/**
 * The account a store last reconciled with. Timestamps only order edits within
 * one account's history — comparing them across accounts is meaningless — so
 * the engine treats a store whose account doesn't match this record as a fresh
 * connect: it must not be pushed to (or merged from) until the lineage is
 * re-established, by an empty/equal reconcile or by the user's explicit choice.
 */
export function lineageAccount(targetId: string): string | null {
  const record = readJson(LINEAGE_KEY);
  const account = record?.[targetId];
  return typeof account === 'string' ? account : null;
}

export function recordLineage(targetId: string, account: string): void {
  try {
    const record = readJson(LINEAGE_KEY) ?? {};
    record[targetId] = account;
    window.localStorage.setItem(LINEAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage errors — worst case the connect question is asked again.
  }
}

/** Forget a store's lineage (on disconnect — the next sign-in is a fresh connect). */
export function clearLineage(targetId: string): void {
  try {
    const record = readJson(LINEAGE_KEY);
    if (!record || !(targetId in record)) return;
    delete record[targetId];
    window.localStorage.setItem(LINEAGE_KEY, JSON.stringify(record));
  } catch {
    // Nothing to clear.
  }
}

/** Snapshot the device's current settings as a blob. */
export function collectSettingsBlob(): SettingsBlob {
  const stamps = sectionStamps();
  return {
    v: 2,
    sections: {
      prefs: { data: readJson(PREFS_STORAGE_KEY), t: stamps.prefs ?? EPOCH },
      a11y: { data: readJson(A11Y_STORAGE_KEY), t: stamps.a11y ?? EPOCH },
      theme: { data: readTheme(), t: stamps.theme ?? EPOCH },
      language: { data: readLanguage(), t: stamps.language ?? EPOCH },
    },
  };
}

/**
 * JSON with object keys sorted recursively — a serialization in which equal
 * content always produces equal bytes. The fingerprint must not depend on the
 * ORDER a writer happened to emit keys in: the same event object is written
 * `{...event, id}` by the personal-dates editors but `{id, kind, anchor, …}`
 * by their load-time sanitizer, so one mount could flip the bytes of an
 * unchanged section. With plain JSON.stringify that read as a content change
 * at an equal stamp, the store's copy won the tie-break, and the startup
 * reconcile adopted-and-reloaded the Mini App on every single open.
 * Undefined-valued keys are skipped, matching what JSON.stringify drops.
 */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .filter((k) => record[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * Stable content identity for one section — canonical (key-order-insensitive)
 * by construction, see canonicalJson. The prefs location's
 * `label`/`labelLocale` are dropped: they're derived by per-device,
 * per-language reverse geocoding (the same place reads "Petah Tikva" /
 * "Петах-Тиква" / "פתח תקווה"), so keeping them would make two devices in one
 * place look different and sync forever. Coordinates, elevation, timezone and
 * any user `customLabel` still count.
 */
export function sectionFingerprint(name: SectionName, data: SectionData): string {
  if (name === 'prefs' && data && typeof data === 'object') {
    return canonicalJson(normalizeForFingerprint(data as Record<string, unknown>));
  }
  return canonicalJson(data ?? null);
}

function normalizeForFingerprint(prefs: Record<string, unknown>): Record<string, unknown> {
  if (typeof prefs.location !== 'object' || prefs.location === null) return prefs;
  const location = { ...(prefs.location as Record<string, unknown>) };
  delete location.label;
  delete location.labelLocale;
  return { ...prefs, location };
}

/** The prefs fingerprint this device last agreed on with the stores, if any. */
export function lastSyncedPrefs(): string | null {
  try {
    return window.localStorage.getItem(SYNCED_KEY);
  } catch {
    return null;
  }
}

export function recordSyncedPrefs(fingerprint: string): void {
  try {
    window.localStorage.setItem(SYNCED_KEY, fingerprint);
  } catch {
    // Ignore storage errors — the worst case is one redundant push.
  }
}

/**
 * How much irreplaceable, user-authored content a section carries: personal-date
 * people and occasions, saved locations, and the pre-1.23 flat custom-date list.
 * These are the parts of a blob nobody can reconstruct — a yahrzeit someone
 * typed in exists nowhere else — as opposed to a theme or a hidden-zman list,
 * which is a preference the user can set again in seconds. Only prefs holds
 * any; every other section counts zero.
 */
function userItemIds(name: SectionName, data: SectionData): Set<string> {
  const ids = new Set<string>();
  if (name !== 'prefs' || data === null || typeof data !== 'object') return ids;
  const prefs = data as Record<string, unknown>;
  const collect = (kind: string, value: unknown): void => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      const id = (item as { id?: unknown } | null)?.id;
      // Identity, not position: an item's index shifts when an earlier one is
      // deleted, which would read as "everything after it changed". Rows with
      // no id (legacy shapes) fall back to their content, which is still stable
      // across devices — an edit to such a row reads as remove + add, the safe
      // direction (it asks rather than dropping something).
      ids.add(`${kind}:${typeof id === 'string' ? id : JSON.stringify(item)}`);
    }
  };
  const personal = prefs.personalDates as { people?: unknown; occasions?: unknown } | undefined;
  collect('person', personal?.people);
  collect('occasion', personal?.occasions);
  collect('date', prefs.customDates); // pre-1.23 flat list
  collect('location', prefs.savedLocations);
  return ids;
}

/** How many such items a section carries. */
function userItemCount(name: SectionName, data: SectionData): number {
  return userItemIds(name, data).size;
}

/**
 * How many user items `from` holds that `to` does not — what writing `to` over
 * `from` would destroy. Renaming a person keeps its id, so an edit counts as
 * zero; only actually dropping a row counts.
 */
export function removedUserItems(from: SettingsBlob, to: SettingsBlob): number {
  let removed = 0;
  for (const name of SECTION_NAMES) {
    const kept = userItemIds(name, to.sections[name].data);
    for (const id of userItemIds(name, from.sections[name].data)) {
      if (!kept.has(id)) removed++;
    }
  }
  return removed;
}

/**
 * A total order over a section's two versions: a present value always beats an
 * absent one; otherwise newer stamp wins, then the side holding more
 * irreplaceable user content, then the larger fingerprint. The tie-break
 * guarantees two diverged devices converge on the same winner instead of each
 * re-pushing its own copy forever (equal stamps happen when one device adopts a
 * section, then a change whose debounced push is lost leaves the stamp
 * unbumped).
 *
 * Why content counts before the fingerprint: an equal stamp means two versions
 * claiming the same moment, with no history to order them, and fingerprint
 * order is just content sorting — a coin flip. Losing it cost real data: a
 * device's mount-written defaults sorted above an account's blob and erased its
 * personal dates. Every genuine deletion bumps the stamp (the change watcher
 * stamps prefs whenever the persisted content differs from the last synced
 * one), so a side that is *poorer at an equal stamp* is never someone's
 * deliberate delete — it is a copy that never had the data.
 *
 * `null` data means the section is ABSENT (there is no UI to set a section to
 * null — a reset writes a real default like theme `system`), so it must never
 * win over a present value, at ANY stamp. Without this, a store holding a
 * partial blob (e.g. web_prefs with no language section => language {null,
 * EPOCH}) beats the device's real value and the reconcile "adopts" the absent
 * section every mount. Language is the pathological case: it lives in the URL,
 * never localStorage, so adopting null can't change what the next load reads —
 * reconcile re-adopts it forever, reloading the page in an infinite loop.
 */
function sectionIsNewer(name: SectionName, a: BlobSection, b: BlobSection): boolean {
  const aAbsent = a.data === null;
  const bAbsent = b.data === null;
  if (aAbsent !== bAbsent) return !aAbsent; // a present value always wins

  const ta = Date.parse(a.t);
  const tb = Date.parse(b.t);
  if (ta !== tb) return ta > tb;

  const ia = userItemCount(name, a.data);
  const ib = userItemCount(name, b.data);
  if (ia !== ib) return ia > ib;

  return sectionFingerprint(name, a.data) > sectionFingerprint(name, b.data);
}

function defaultSection(name: SectionName): BlobSection {
  return { data: name === 'prefs' || name === 'a11y' ? null : null, t: EPOCH };
}

/** Merge blobs section-by-section, taking the newest version of each. */
export function mergeBlobs(blobs: SettingsBlob[]): SettingsBlob {
  const sections = {} as Record<SectionName, BlobSection>;
  for (const name of SECTION_NAMES) {
    let best: BlobSection | null = null;
    for (const blob of blobs) {
      const s = blob.sections[name];
      if (s && (!best || sectionIsNewer(name, s, best))) best = s;
    }
    sections[name] = best ?? defaultSection(name);
  }
  return { v: 2, sections };
}

/** Every section stamp in a blob (feed to observeStamps to advance the clock). */
export function blobStamps(blob: SettingsBlob): string[] {
  return SECTION_NAMES.map((name) => blob.sections[name].t);
}

/**
 * Opt-in sync tracing. Enable in the browser console with
 * `localStorage.setItem('zmanim:sync-debug','1')` — then reconcile decisions
 * print with a `[zmanim-sync]` tag. No-op otherwise.
 */
export function syncDebug(...args: unknown[]): void {
  try {
    if (window.localStorage.getItem('zmanim:sync-debug') === '1') {
      console.log('[zmanim-sync]', ...args);
    }
  } catch {
    // Ignore.
  }
}

/** Section names whose merged content differs from `local`'s. */
export function changedSections(local: SettingsBlob, merged: SettingsBlob): SectionName[] {
  return SECTION_NAMES.filter(
    (name) => sectionFingerprint(name, merged.sections[name].data) !== sectionFingerprint(name, local.sections[name].data),
  );
}

/** Parse an untrusted value into a blob, or null when it isn't one. Migrates v1. */
export function parseSettingsBlob(raw: unknown): SettingsBlob | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;
  if (data.v === 1) return migrateV1(data);
  if (data.v !== 2 || typeof data.sections !== 'object' || data.sections === null) return null;

  const src = data.sections as Record<string, unknown>;
  const sections = {} as Record<SectionName, BlobSection>;
  for (const name of SECTION_NAMES) {
    const s = src[name];
    if (typeof s !== 'object' || s === null) {
      sections[name] = defaultSection(name);
      continue;
    }
    const { data: sData, t } = s as Record<string, unknown>;
    const stamp = typeof t === 'string' && !Number.isNaN(Date.parse(t)) ? t : EPOCH;
    sections[name] = { data: coerceSectionData(name, sData), t: stamp };
  }
  const blob: SettingsBlob = { v: 2, sections };
  return JSON.stringify(blob).length <= MAX_BLOB_CHARS ? blob : null;
}

/** Wrap a legacy v1 blob's fields into v2 sections sharing its single stamp. */
function migrateV1(data: Record<string, unknown>): SettingsBlob | null {
  const t = typeof data.updatedAt === 'string' && !Number.isNaN(Date.parse(data.updatedAt)) ? data.updatedAt : EPOCH;
  return {
    v: 2,
    sections: {
      prefs: { data: coerceSectionData('prefs', data.prefs), t },
      a11y: { data: coerceSectionData('a11y', data.a11y), t },
      theme: { data: coerceSectionData('theme', data.theme), t },
      language: { data: coerceSectionData('language', data.language), t },
    },
  };
}

function coerceSectionData(name: SectionName, value: unknown): SectionData {
  if (name === 'prefs' || name === 'a11y') {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
  if (name === 'theme') return value === 'light' || value === 'dark' || value === 'system' ? value : null;
  return typeof value === 'string' && LANGUAGES.includes(value) ? value : null;
}

/** Serialize for a store; null when the blob exceeds the size cap. */
export function serializeSettingsBlob(blob: SettingsBlob): string | null {
  const raw = JSON.stringify(blob);
  return raw.length <= MAX_BLOB_CHARS ? raw : null;
}

export function deserializeSettingsBlob(raw: string): SettingsBlob | null {
  if (raw.length > MAX_BLOB_CHARS) return null;
  try {
    return parseSettingsBlob(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Write the named sections' data back to their localStorage keys and adopt
 * their stamps. `language` is intentionally NOT written here (it lives in the
 * URL, not localStorage) — the caller applies it by navigating. The caller
 * reloads afterwards; the providers read these keys once at mount (and
 * sanitize them there, which is why no deeper validation happens here).
 */
export function applyBlobSections(blob: SettingsBlob, names: SectionName[]): void {
  const writeJson = (key: string, value: SectionData) => {
    if (value === null || typeof value !== 'object') window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  };
  for (const name of names) {
    const { data, t } = blob.sections[name];
    try {
      if (name === 'prefs') writeJson(PREFS_STORAGE_KEY, data);
      else if (name === 'a11y') writeJson(A11Y_STORAGE_KEY, data);
      else if (name === 'theme') {
        if (typeof data === 'string') window.localStorage.setItem(THEME_STORAGE_KEY, data);
        else window.localStorage.removeItem(THEME_STORAGE_KEY);
      }
      // 'language' is applied by navigation, not storage.
      stampSection(name, t);
    } catch {
      // Ignore storage errors (private mode, quota, etc.).
    }
  }
}
