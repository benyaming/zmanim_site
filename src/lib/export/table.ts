import type { DateTime } from 'luxon';

import { createHebrewFormatter, getDayEvents, getDayInfo, localizedHolidayLabel } from '@/lib/calendar';
import { formatDuration, formatTime } from '@/lib/format';
import { getDailyLearning, LEARNING_CYCLE_KEYS, type LearningCycleKey } from '@/lib/learning';
import type { AppLocation } from '@/lib/location';
import {
  applyLehumra,
  applyLehumraToEvents,
  computeZmanim,
  DEFAULT_HAVDALAH_OPINION,
  type HavdalahOpinion,
  havdalahTime,
  ZMANIM,
} from '@/lib/zmanim';

/** Hard cap on table-export size (two years, leap-safe). */
export const MAX_TABLE_DAYS = 732;

/** The optional per-day columns beyond the zmanim themselves. */
export type DayColumnKey =
  | 'parsha'
  | 'candleLighting'
  | 'havdalah'
  | 'fastStart'
  | 'fastEnd'
  | 'mevarchim'
  | 'omer'
  // Daily-learning cycles (Daf Yomi, Mishna Yomit, …) render as text columns.
  | LearningCycleKey;

/** Day-column keys that hold free text (not clock times) — left-aligned, wider. */
export const TEXT_DAY_COLUMNS: ReadonlySet<DayColumnKey> = new Set<DayColumnKey>(['parsha', ...LEARNING_CYCLE_KEYS]);

export interface ZmanimTableOptions {
  /** First day, inclusive. Only the calendar date is used. */
  start: DateTime;
  /** Last day, inclusive. */
  end: DateTime;
  /** Selected zman keys (any order — output follows definition order). */
  keys: string[];
  location: AppLocation;
  candleLightingOffset: number;
  useElevation: boolean;
  lehumra: boolean;
  locale: string;
  /** Governs the havdalah column (same setting as the calendar). */
  havdalahOpinion?: HavdalahOpinion;
  /** Wraps a special-Shabbat name for display ("Nachamu" → "Shabbat Nachamu"). */
  specialShabbatLabel?: (name: string) => string;
  /** Learning cycles to include as columns (empty = none, skips the lookup). */
  learningKeys?: LearningCycleKey[];
}

export type ZmanimTableRow = {
  iso: string;
  /** Localized short civil date, e.g. "7/6/2026". */
  dateLabel: string;
  /** Localized short weekday name. */
  weekday: string;
  /** "12 Tammuz" in the active locale. */
  hebrewDate: string;
  /** Significant-day name (Yom Tov / fast / …), or empty. */
  holiday: string;
  /** Parsha with the special-Shabbat name appended (Shabbat rows only), or empty. */
  parsha: string;
  /** Formatted event times for the day, or empty when the event doesn't occur. */
  candleLighting: string;
  havdalah: string;
  fastStart: string;
  fastEnd: string;
  /** "✓" on Shabbat Mevarchim, else empty. */
  mevarchim: string;
  /** Day of the omer (1-49) as text, else empty. */
  omer: string;
  /** One formatted value per key (clock time, h:mm:ss duration, or a dash). */
  cells: string[];
  // Each learning cycle's localized reading for the day (empty when not requested
  // or when the cycle hadn't begun / is skipped that day).
} & Record<LearningCycleKey, string>;

export interface ZmanimTable {
  /** The selected keys in canonical (chronological definition) order. */
  keys: string[];
  rows: ZmanimTableRow[];
}

/** Selected keys re-ordered to the canonical ZMANIM definition order. */
export function orderedZmanKeys(keys: string[]): string[] {
  const wanted = new Set(keys);
  return ZMANIM.filter((z) => wanted.has(z.key)).map((z) => z.key);
}

/** Number of days from start to end inclusive (0 when end precedes start). */
export function tableDayCount(start: DateTime, end: DateTime): number {
  const days = Math.floor(end.startOf('day').diff(start.startOf('day'), 'days').days) + 1;
  return Math.max(0, days);
}

/**
 * One row per day in [start, end], one formatted cell per selected zman.
 * Times are formatted exactly like the day panel (locale clock format, lehumra
 * rounding when enabled, "—" for undefined times such as polar days); the
 * shaah-zmanis durations render as h:mm:ss. Day events (candle lighting,
 * havdalah, fast bookends) and the parsha come from the same logic as the
 * calendar cells, so the table always agrees with the grid.
 */
export function buildZmanimTable(o: ZmanimTableOptions): ZmanimTable {
  const keys = orderedZmanKeys(o.keys);
  const formatter = createHebrewFormatter(o.locale);
  const havdalahOpinion = o.havdalahOpinion ?? DEFAULT_HAVDALAH_OPINION;
  const specialShabbat = o.specialShabbatLabel ?? ((name: string) => name);
  const learningKeys = o.learningKeys ?? [];
  const rows: ZmanimTableRow[] = [];
  const days = Math.min(tableDayCount(o.start, o.end), MAX_TABLE_DAYS);

  for (let i = 0; i < days; i++) {
    const date = o.start.startOf('day').plus({ days: i });
    const computed = computeZmanim({
      lat: o.location.lat,
      lng: o.location.lng,
      date,
      elevation: o.location.elevation,
      useElevation: o.useElevation,
      timeZoneId: o.location.timeZoneId,
      candleLightingOffset: o.candleLightingOffset,
    });
    const zmanim = o.lehumra ? applyLehumra(computed) : computed;
    const byKey = new Map(zmanim.map((z) => [z.key, z]));

    const info = getDayInfo(date, formatter, o.locale, o.location.inIsrael);
    const holiday = localizedHolidayLabel(o.locale, info.label, info.yomTovIndex, info.dayOfChanukah) ?? '';

    // Same event set as the calendar cells, incl. the earliest-opinion fast
    // end (Geonim 5.95°) and the per-event lehumra rounding directions.
    const timeByKey = Object.fromEntries(zmanim.map((z) => [z.key, z.time]));
    const rawEvents = getDayEvents(
      date,
      {
        candleLighting: timeByKey.candleLighting,
        alos: timeByKey.alosHashachar,
        sunset: timeByKey.sunset,
        tzaisGeonim: timeByKey.tzaisGeonim,
        tzais: timeByKey.tzais,
        tzais42: timeByKey.tzais42,
        havdalah: havdalahTime(havdalahOpinion, timeByKey),
      },
      o.location.inIsrael,
    ).filter((e) => e.type !== 'fastEnd' || e.zmanKey === 'tzaisGeonim');
    const events = o.lehumra ? applyLehumraToEvents(rawEvents) : rawEvents;
    const eventTime = (type: string) => {
      const e = events.find((ev) => ev.type === type);
      return e ? formatTime(e.time, o.locale) : '';
    };

    // Every learning key present as a column, empty by default; filled only when
    // any learning column was requested (the lookup is skipped otherwise).
    const learning = Object.fromEntries(LEARNING_CYCLE_KEYS.map((k) => [k, ''])) as Record<LearningCycleKey, string>;
    if (learningKeys.length > 0) {
      for (const item of getDailyLearning(date, o.location.inIsrael, o.locale)) learning[item.key] = item.reading;
    }

    rows.push({
      iso: date.toISODate() ?? '',
      dateLabel: date.setLocale(o.locale).toLocaleString({ year: 'numeric', month: 'numeric', day: 'numeric' }),
      weekday: date.setLocale(o.locale).toLocaleString({ weekday: 'short' }),
      hebrewDate: `${info.hebrewDayOfMonth} ${info.hebrewMonth}`,
      holiday,
      parsha: [info.parsha, info.specialShabbos ? specialShabbat(info.specialShabbos) : null]
        .filter(Boolean)
        .join(' · '),
      candleLighting: eventTime('candle'),
      havdalah: eventTime('havdalah'),
      fastStart: eventTime('fastStart'),
      fastEnd: eventTime('fastEnd'),
      mevarchim: info.isShabbosMevorchim ? '\u2713' : '',
      omer: info.omer > 0 ? String(info.omer) : '',
      cells: keys.map((key) => {
        const z = byKey.get(key);
        if (!z) return '—';
        return z.duration ? formatDuration(z.durationMillis) : formatTime(z.time, o.locale);
      }),
      ...learning,
    });
  }

  return { keys, rows };
}
