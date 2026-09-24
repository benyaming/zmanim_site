/**
 * The calendar (.ics) export's events: what goes into the file, independent of
 * how it is serialized.
 *
 * Every time comes from the same domain functions the app shows —
 * computeZmanim, getDayEvents, getDayInfo and the personal-dates engine — so
 * the file always agrees with the panel. Nothing here re-derives a rule.
 *
 * Rounding is applied ONCE, to raw instants, by each event's meaning. Rounded
 * times are never fed back into getDayEvents: a fast's start is read off dawn,
 * which rounds UP as a standalone zman but DOWN as a fast's start, and rounding
 * dawn first would leave the start a minute late.
 *
 * Pure TypeScript — no React, DOM or client-only modules — so a server-side
 * feed renderer can run it unchanged. Labels arrive through the translator.
 */

import { JewishCalendar } from 'kosher-zmanim';
import { DateTime } from 'luxon';

import {
  createHebrewFormatter,
  type DayEvent,
  dayEventZmanKeys,
  type DayInfo,
  fastEndZmanKey,
  getDayEvents,
  getDayInfo,
  localizedHolidayLabel,
} from '@/lib/calendar';
import { formatTime, formatTimeWithSeconds } from '@/lib/format';
import { type AppLocation, isIsraelTimezone } from '@/lib/location';
import { type Observance, type ObservanceKind, observancesOn, type PersonalDatesData } from '@/lib/personal-dates';
import { SITE_HOST } from '@/lib/site';
import {
  applyLehumraToEvents,
  computeZmanim,
  type HavdalahOpinion,
  havdalahTime,
  havdalahZmanKey,
  roundTimeLehumra,
  zmanLabels,
  zmanLehumraDirection,
  ZMANIM,
} from '@/lib/zmanim';

import { type IcsCategory, MAX_ICS_DAYS, sanitizeIcsZmanKeys } from './ics-preset';

/** A root-scoped translator (paths begin `events.`, `zmanim.`, `export.`…). */
export interface CalendarTranslator {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
}

export type CalendarEventKind = DayEvent['type'] | 'zman' | 'holiday' | 'parsha' | 'personal';

interface EventBase {
  kind: CalendarEventKind;
  /** The opinion (fast end), zman key (daily zman) or observance kind (personal); absent otherwise. */
  key?: string;
  /** Stable across exports: kind, opinion, source day, place or owner — never settings. */
  uid: string;
  /** The source civil day, in the location's zone, as an ISO date. */
  date: string;
  title: string;
  description: string;
}

/** A moment: candle lighting, havdalah, a fast's bounds, a daily zman. */
export interface TimedCalendarEvent extends EventBase {
  allDay: false;
  /** The instant, rounded to the minute when lehumra is on. */
  start: DateTime;
}

/** A day label: holiday, parsha, personal date. */
export interface AllDayCalendarEvent extends EventBase {
  allDay: true;
}

export type CalendarEvent = TimedCalendarEvent | AllDayCalendarEvent;

export interface CalendarExportOptions {
  /** First civil day, inclusive, as an ISO date in the location's zone. */
  startIso: string;
  /** Days in the range, counting the first (1 – MAX_ICS_DAYS). */
  days: number;
  location: AppLocation;
  /** The place's display name, used in titles. */
  placeLabel: string;
  categories: Readonly<Record<IcsCategory, boolean>>;
  /** Daily zmanim; passed through sanitizeIcsZmanKeys (valid keys, definition order, capped). */
  zmanKeys: readonly string[];
  /** Observance kinds to include; empty = no personal dates. */
  personalKinds: readonly ObservanceKind[];
  personalDates: PersonalDatesData;
  candleLightingOffset: number;
  havdalahOpinion: HavdalahOpinion;
  /** The user's hidden fast-end opinions (calendar settings). */
  hiddenFastEnd: readonly string[];
  useElevation: boolean;
  lehumra: boolean;
  /** Report language. */
  locale: string;
  tr: CalendarTranslator;
  /** Title of a personal observance — the panel's chip text. */
  personalTitle: (obs: Observance) => string;
}

export interface CalendarExport {
  events: CalendarEvent[];
  /**
   * Timed events of a selected kind whose time can't be computed here (a
   * polar day or night). They are left out, never given an invented time.
   */
  unavailable: number;
}

/**
 * cyrb53 — a small, well-distributed 53-bit string hash. Identity only (event
 * UIDs), never security.
 */
function hash53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * A place's identity for event UIDs: the full coordinates and the normalized
 * IANA zone. Never the display label or the saved-location id — the latter is
 * 'current' or a random bookmark id, so two places would collide and one place
 * would change identity once bookmarked. Elevation and calculation settings
 * stay out: changing them revises the same events. Coordinates keep full
 * precision (their representation is normalized, not rounded), and this is an
 * identity, never a calculation cache key.
 */
export function locationFingerprint(location: Pick<AppLocation, 'lat' | 'lng' | 'timeZoneId'>): string {
  // Legacy persisted locations may carry Asia/Hebron or Asia/Gaza; fresh
  // lookups normalize both to Asia/Jerusalem (see tzFromLatLng).
  const zone = isIsraelTimezone(location.timeZoneId) ? 'Asia/Jerusalem' : location.timeZoneId;
  return hash53(`${String(location.lat)}|${String(location.lng)}|${zone}`);
}

const DEF_BY_KEY = new Map(ZMANIM.map((z) => [z.key, z]));
const BASE_KEY_COUNT = new Map<string, number>();
for (const z of ZMANIM) BASE_KEY_COUNT.set(z.base, (BASE_KEY_COUNT.get(z.base) ?? 0) + 1);

/**
 * Kinds whose number-0 occurrence is the anchor event itself (born, married,
 * passed away) — reported by both the Hebrew and the civil kind of a pair.
 */
const ORIGIN_KINDS: ReadonlySet<ObservanceKind> = new Set([
  'hebrewBirthday',
  'civilBirthday',
  'yahrzeit',
  'civilDeathAnniversary',
  'hebrewAnniversary',
  'civilAnniversary',
]);

const EVENT_SLUG: Record<DayEvent['type'], string> = {
  candle: 'candle',
  havdalah: 'havdalah',
  fastStart: 'fast-start',
  fastEnd: 'fast-end',
};

/** Build the events for a range. Throws RangeError on an invalid range. */
export function buildCalendarEvents(o: CalendarExportOptions): CalendarExport {
  const tz = o.location.timeZoneId;
  const first = DateTime.fromISO(o.startIso, { zone: tz });
  if (!first.isValid) throw new RangeError(`Invalid start date: ${o.startIso}`);
  if (!Number.isInteger(o.days) || o.days < 1 || o.days > MAX_ICS_DAYS) {
    throw new RangeError(`Range must be 1–${MAX_ICS_DAYS} days, got ${o.days}`);
  }

  const { tr, locale } = o;
  const labels = zmanLabels(tr);
  const formatter = createHebrewFormatter(locale);
  const fingerprint = locationFingerprint(o.location);
  const inIsrael = o.location.inIsrael;
  const zmanKeys = sanitizeIcsZmanKeys(o.zmanKeys);
  const havdalahKey = havdalahZmanKey(o.havdalahOpinion);
  const computeKeys = new Set([...dayEventZmanKeys(havdalahKey), ...zmanKeys]);
  const personalKinds = new Set(o.personalKinds);
  const wantPersonal =
    personalKinds.size > 0 && (o.personalDates.people.length > 0 || o.personalDates.occasions.length > 0);
  const { candles, fasts, holidays, parsha } = o.categories;
  const needTimes = candles || fasts || zmanKeys.length > 0;

  const footer = tr('export.generatedBy', { site: SITE_HOST });
  const elevationNote =
    o.useElevation && typeof o.location.elevation === 'number' && o.location.elevation > 0
      ? tr('export.noteElevation', { meters: o.location.elevation })
      : '';
  const notes = [o.lehumra ? tr('export.noteLehumra') : '', elevationNote].filter(Boolean);
  const dayLabelDescription = [tr('export.icsDayLabelNote'), footer].join('\n');

  // Each source day's noon, built from date COMPONENTS in the target zone (a
  // tz/DST-safe calendar day), plus one extra day: the eve's events need to
  // know what tomorrow is.
  const noons: DateTime[] = [];
  for (let i = 0; i <= o.days; i++) {
    const civil = first.plus({ days: i });
    noons.push(DateTime.fromObject({ year: civil.year, month: civil.month, day: civil.day, hour: 12 }, { zone: tz }));
  }
  const infos: DayInfo[] = noons.map((noon) => getDayInfo(noon, formatter, locale, inIsrael));
  const holidayLabel = (info: DayInfo) =>
    localizedHolidayLabel(locale, info.label, info.yomTovIndex, info.dayOfChanukah) ?? '';

  const events: CalendarEvent[] = [];
  let unavailable = 0;

  const withPlace = (title: string, time: DateTime) =>
    [title, o.placeLabel, o.lehumra ? '' : formatTimeWithSeconds(time.setZone(tz), locale)].filter(Boolean).join(' · ');

  const timedDescription = (noon: DateTime, time: DateTime, rule: string) => {
    const local = time.setZone(tz);
    const clock = o.lehumra ? formatTime(local, locale) : formatTimeWithSeconds(local, locale);
    const day = noon.setLocale(locale).toLocaleString({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return [`${day} · ${clock} (${tz})`, rule, ...notes, footer].filter(Boolean).join('\n');
  };

  for (let i = 0; i < o.days; i++) {
    const noon = noons[i];
    const info = infos[i];
    const tomorrow = infos[i + 1];
    const iso = noon.toISODate() ?? '';
    const compact = iso.replaceAll('-', '');

    // Day labels and personal dates need no times: skip the solar work when
    // nothing timed is selected.
    const computed = needTimes
      ? computeZmanim({
          lat: o.location.lat,
          lng: o.location.lng,
          date: noon,
          elevation: o.location.elevation,
          useElevation: o.useElevation,
          timeZoneId: tz,
          candleLightingOffset: o.candleLightingOffset,
          keys: computeKeys,
        })
      : [];
    const timeByKey: Record<string, DateTime | null> = Object.fromEntries(computed.map((z) => [z.key, z.time]));

    // Day events from RAW times, then one meaning-aware rounding pass.
    if (candles || fasts) {
      const raw = getDayEvents(
        noon,
        {
          candleLighting: timeByKey.candleLighting,
          sunset: timeByKey.sunset,
          havdalah: havdalahTime(o.havdalahOpinion, timeByKey),
          zmanimByKey: timeByKey,
        },
        inIsrael,
        o.hiddenFastEnd,
      );
      const dayEvents = o.lehumra ? applyLehumraToEvents(raw) : raw;
      for (const e of dayEvents) {
        // Yom Kippur is a fast AND a rest day: getDayEvents carries its onset
        // as the eve's candle lighting and its end as havdalah. Either
        // category brings those two in — once each, since they are one event.
        const ykCandle = e.type === 'candle' && tomorrow.yomTovIndex === JewishCalendar.YOM_KIPPUR;
        const ykEnd = e.type === 'havdalah' && info.yomTovIndex === JewishCalendar.YOM_KIPPUR;
        const selected =
          ykCandle || ykEnd ? candles || fasts : e.type === 'candle' || e.type === 'havdalah' ? candles : fasts;
        if (!selected) continue;
        if (!e.time) {
          unavailable++;
          continue;
        }

        let name: string;
        let rule: string;
        let opinion = '';
        if (ykCandle) {
          name = tr('export.icsYomKippurCandle');
          rule = tr('events.candleOffset', { minutes: o.candleLightingOffset });
        } else if (ykEnd) {
          name = tr('export.icsYomKippurEnds');
          rule = labels.shita(havdalahKey);
        } else if (e.type === 'candle') {
          // After nightfall (2nd Yom Tov night, Yom Tov on Motzei Shabbat) it is
          // a "not before" time, lit at the havdalah opinion's nightfall.
          name = e.afterNightfall ? `${tr('events.candle')} (${tr('events.candleAfterNightfall')})` : tr('events.candle');
          rule = e.afterNightfall ? labels.shita(havdalahKey) : tr('events.candleOffset', { minutes: o.candleLightingOffset });
        } else if (e.type === 'havdalah') {
          name = tr('events.havdalah');
          rule = labels.shita(havdalahKey);
        } else if (e.type === 'fastStart') {
          // A minor fast starts on its own day (at dawn); Tisha b'Av at the
          // eve's sunset, so its name is tomorrow's.
          const fastName = info.category === 'taanis' ? holidayLabel(info) : holidayLabel(tomorrow);
          name = [tr('events.fastStart'), fastName].filter(Boolean).join(' · ');
          rule = e.zmanKey ? labels.shita(e.zmanKey) || labels.name(e.zmanKey) : labels.name('sunset');
        } else {
          opinion = e.zmanKey ?? '';
          const shitaKey = fastEndZmanKey(opinion);
          name = [`${tr('events.fastEnd')} (${labels.shitaShort(shitaKey)})`, holidayLabel(info)].filter(Boolean).join(' · ');
          rule = labels.shita(shitaKey);
        }

        events.push({
          kind: e.type,
          ...(opinion ? { key: opinion } : {}),
          uid: `${EVENT_SLUG[e.type]}${opinion ? `-${opinion}` : ''}-${compact}-${fingerprint}@${SITE_HOST}`,
          allDay: false,
          date: iso,
          start: e.time.toUTC(),
          title: withPlace(name, e.time),
          description: timedDescription(noon, e.time, rule),
        });
      }
    }

    for (const key of zmanKeys) {
      const rawTime = timeByKey[key] ?? null;
      if (!rawTime) {
        unavailable++;
        continue;
      }
      const time = o.lehumra ? roundTimeLehumra(rawTime, zmanLehumraDirection(key)) : rawTime;
      const def = DEF_BY_KEY.get(key);
      const multi = def ? (BASE_KEY_COUNT.get(def.base) ?? 1) > 1 : false;
      const shitaShort = multi ? labels.shitaShort(key) : '';
      const name = shitaShort ? `${labels.name(key)} (${shitaShort})` : labels.name(key);
      events.push({
        kind: 'zman',
        key,
        uid: `zman-${key}-${compact}-${fingerprint}@${SITE_HOST}`,
        allDay: false,
        date: iso,
        start: time.toUTC(),
        title: withPlace(name, time),
        description: timedDescription(noon, time, multi ? labels.shita(key) : ''),
      });
    }

    if (holidays) {
      // The grid's rule: a day can carry two markers (Chanukah on Rosh
      // Chodesh) — keep both, in one event, rather than letting one win.
      const label = holidayLabel(info);
      const parts = label ? [label] : [];
      if (info.isRoshChodesh && !(label && info.category === 'roshChodesh')) parts.push(tr('categories.roshChodesh'));
      if (parts.length > 0) {
        events.push({
          kind: 'holiday',
          uid: `holiday-${compact}-${fingerprint}@${SITE_HOST}`,
          allDay: true,
          date: iso,
          title: parts.join(' · '),
          description: dayLabelDescription,
        });
      }
    }

    if (parsha && noon.weekday === 6) {
      const parts = [
        info.parsha ? tr('panel.parasha', { name: info.parsha }) : '',
        info.specialShabbos ? tr('panel.specialShabbat', { name: info.specialShabbos }) : '',
      ].filter(Boolean);
      if (parts.length > 0) {
        events.push({
          kind: 'parsha',
          uid: `parsha-${compact}-${fingerprint}@${SITE_HOST}`,
          allDay: true,
          date: iso,
          title: parts.join(' · '),
          description: dayLabelDescription,
        });
      }
    }

    if (wantPersonal) {
      // Personal dates are civil days, independent of the place: resolve them
      // on the device-local day, exactly as the calendar grid does.
      const local = DateTime.fromObject({ year: noon.year, month: noon.month, day: noon.day });
      const seen = new Set<string>();
      for (const obs of observancesOn(local, o.personalDates)) {
        if (!personalKinds.has(obs.kind)) continue;
        // Ids are free-form strings (synced or imported data can hold any), so
        // the owner is hashed as a JSON tuple — joining them with a separator
        // could make two different owners read the same.
        const owner = hash53(JSON.stringify([obs.sourceType, obs.sourceId, obs.eventId]));
        // The origin day itself (born / married / passed away) is ONE event that
        // both calendars' kinds report: it gets a kind-free identity, so its UID
        // doesn't change with which of the pair is selected.
        const origin = obs.number === 0 && ORIGIN_KINDS.has(obs.kind);
        const uid = origin
          ? `personal-origin-${compact}-${owner}@${SITE_HOST}`
          : `personal-${obs.kind}-${compact}-${owner}@${SITE_HOST}`;
        if (seen.has(uid)) continue;
        seen.add(uid);
        const note = obs.kind === 'yahrzeit' && !origin ? tr('export.icsYahrzeitNote') : '';
        events.push({
          kind: 'personal',
          key: obs.kind,
          uid,
          allDay: true,
          date: iso,
          title: o.personalTitle(obs),
          description: [note, footer].filter(Boolean).join('\n'),
        });
      }
    }
  }

  // Deterministic order: by day, day labels first, then by time.
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    if (!a.allDay && !b.allDay) {
      const diff = a.start.toMillis() - b.start.toMillis();
      if (diff !== 0) return diff;
    }
    return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
  });

  return { events, unavailable };
}
