import { JewishDate } from 'kosher-zmanim';
import type { DateTime } from 'luxon';

import {
  createHebrewFormatter,
  DEFAULT_HIDDEN_FAST_END,
  dayEventZmanKeys,
  getDayEvents,
  getDayInfo,
  localizedHolidayLabel,
} from '@/lib/calendar';
import { formatDuration, formatMoladParts, formatTime, formatTimePlain } from '@/lib/format';
import { getDailyLearning, LEARNING_CYCLE_KEYS, type LearningCycleKey } from '@/lib/learning';
import type { AppLocation } from '@/lib/location';
import {
  applyLehumra,
  applyLehumraToEvents,
  computeZmanim,
  DEFAULT_HAVDALAH_OPINION,
  type HavdalahOpinion,
  havdalahTime,
  havdalahZmanKey,
  ZMANIM,
} from '@/lib/zmanim';

/** Hard cap on table-export size (two years, leap-safe). */
export const MAX_TABLE_DAYS = 732;

/**
 * Every per-day column the export can render, beyond the zmanim themselves.
 * The four leading identity columns (date / weekday / Hebrew date / holiday)
 * are toggleable columns like any other — each maps to a same-named field on
 * `ZmanimTableRow`, so a single column model drives all three writers.
 */
export type DayColumnKey =
  | 'dateLabel'
  | 'dayWithMonth'
  | 'dayOfMonth'
  | 'weekday'
  | 'hebrewDate'
  | 'hebrewDay'
  | 'holiday'
  | 'parsha'
  | 'mevarchimName'
  | 'molad'
  // Not a row field: a synthetic column whose cell joins several other fields
  // (see `ExportColumn.fields`). The PDF uses it to merge the day's identity
  // into one column and its holiday / parsha / Mevarchim into another.
  | 'events'
  | 'candleLighting'
  | 'havdalah'
  | 'fastStart'
  | 'fastEnd'
  | 'mevarchim'
  | 'omer'
  // Daily-learning cycles (Daf Yomi, Mishna Yomit, …) render as text columns.
  | LearningCycleKey;

/** Day-column keys that hold free text (not clock times) — start-aligned, not tabular. */
export const TEXT_DAY_COLUMNS: ReadonlySet<DayColumnKey> = new Set<DayColumnKey>([
  // The print layout folds the Hebrew date and weekday in beside the day, so
  // this cell is prose ("1 Aug · 18 Av · Sat") and reads start-aligned;
  // centring it leaves the day numbers ragged down the page.
  'dayWithMonth',
  'weekday',
  'hebrewDate',
  'holiday',
  'parsha',
  'mevarchimName',
  'molad',
  'events',
  ...LEARNING_CYCLE_KEYS,
]);

/**
 * Relative print width per day-column kind (zmanim columns are the 1.0 unit).
 * Free-text columns (holiday, parsha, readings) need more room than a clock
 * time; short markers (omer, mevarchim) need less. Used to proportion the PDF
 * columns so headers wrap cleanly and no column is starved.
 */
const DAY_COLUMN_WEIGHT: Partial<Record<DayColumnKey, number>> = {
  dateLabel: 1.7,
  dayWithMonth: 1.2,
  weekday: 1.1,
  hebrewDate: 1.8,
  holiday: 2.6,
  parsha: 2.6,
  events: 2.8,
  candleLighting: 1,
  havdalah: 1,
  fastStart: 1,
  fastEnd: 1,
  mevarchim: 0.8,
  omer: 0.8,
};

/** Relative print width for a day column (learning readings are text → wide). */
export function dayColumnWeight(key: DayColumnKey): number {
  return DAY_COLUMN_WEIGHT[key] ?? (LEARNING_CYCLE_KEYS.includes(key as LearningCycleKey) ? 2.6 : 1);
}

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
  /** Localized "Shabbat Mevarchim" caption for the merged events cell. */
  mevarchimLabel?: string;
  /**
   * Renders the molad announcement sentence; omitted = no molad text. Gets the
   * announced MONTH and the civil date as well as the weekday, because the PDF
   * prints this in a page footer where — unlike the day panel — there is no
   * surrounding row to say when "Tuesday" is or which month is being announced.
   */
  moladLabel?: (parts: { month: string; weekday: string; date: string; time: string; chalakim: number }) => string;
  /** Learning cycles to include as columns (empty = none, skips the lookup). */
  learningKeys?: LearningCycleKey[];
  /**
   * Print-style times: the locale's clock without its AM/PM suffix ("4:53"),
   * the way a printed luach sets them. On for the PDF, off for CSV/Excel,
   * whose cells are data and keep the full locale format.
   */
  plainTimes?: boolean;
  /**
   * The user's hidden fast-end opinions (the calendar-settings picker), so the
   * export answers with the same opinions the app shows. Defaults to the app's
   * default hide-list.
   */
  hiddenFastEnd?: readonly string[];
  /**
   * Labels a fast-end opinion key ("tzais72" → "Р״Т 72") for the `fastEnds`
   * pairs. Without it the pairs stay empty and only the single `fastEnd` slot
   * is filled — the CSV/Excel shape.
   */
  fastEndLabel?: (opinionKey: string) => string;
}

export type ZmanimTableRow = {
  iso: string;
  /** Localized short civil date, e.g. "7/6/2026". */
  dateLabel: string;
  /**
   * The day WITH its short civil month ("1 Aug" / "1 авг." / "1 באוג׳"),
   * carrying a 2-digit year when the range spans more than one. The PDF prints
   * this on EVERY row, so no row's date depends on reading upwards for context.
   *
   * Formatted as one date rather than joined by hand: Intl's STANDALONE month
   * differs from its in-date form (ru gives "июль" alone but "июл." in a date),
   * and only the combined format orders the parts correctly per locale.
   */
  dayWithMonth: string;
  /**
   * The bare civil day of month ("6"), for sheets paged by civil month: the
   * month is in the sheet's title, so repeating it on thirty rows is noise.
   */
  dayOfMonth: string;
  /** Localized short weekday name. */
  weekday: string;
  /** "12 Tammuz" in the active locale. */
  hebrewDate: string;
  /** The bare Hebrew day of month ("12"), for sheets paged by Hebrew month. */
  hebrewDay: string;
  /**
   * "5786-05" — the Hebrew year and month this day belongs to, the grouping
   * key for Hebrew-month pagination (names alone won't do: two Adars, and the
   * year rolls mid-civil-year).
   */
  hebrewMonthId: string;
  /** Significant-day name (Yom Tov / fast / …), or empty. */
  holiday: string;
  /** Parsha with the special-Shabbat name appended (Shabbat rows only), or empty. */
  parsha: string;
  /** Formatted event times for the day, or empty when the event doesn't occur. */
  candleLighting: string;
  havdalah: string;
  fastStart: string;
  fastEnd: string;
  /**
   * Every VISIBLE fast-end opinion for the day as a labelled pair — what the
   * PDF's fast footnote prints. Empty unless a `fastEndLabel` was provided;
   * the single `fastEnd` stays the one answer a spreadsheet cell wants.
   */
  fastEnds: { label: string; time: string }[];
  /**
   * The day's chatzot, always computed: the Tisha b'Av footnote prints it (the
   * turn of the day's restrictions) whether or not chatzot was selected.
   */
  chatzosTime: string;
  /** "✓" on Shabbat Mevarchim, else empty. Kept tick-shaped for CSV/Excel. */
  mevarchim: string;
  /**
   * The Shabbat Mevarchim name spelled out, for the PDF's merged events cell
   * (a bare "✓" means nothing once it is no longer under its own header).
   */
  mevarchimName: string;
  /**
   * The molad announcement for this day, or empty. Only Rosh Chodesh / Shabbat
   * Mevarchim rows carry one; the PDF prints it in the page footer rather than
   * spending a column on a value that appears once a month.
   */
  molad: string;
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

/** One footer block: a bold lead label (the fast's name, "Molad Av") and its content. */
export interface PageFootnote {
  label: string;
  /** Prose content (the molad sentence). Empty when `groups` carry the content. */
  text: string;
  /**
   * Structured content: headed groups of label→time pairs the renderer sets as
   * aligned columns ("Начало 19:44 · Хацот 12:46 · Окончание: 5.95° 20:10 …")
   * instead of run-on prose — a fast's start, its chatzot, its per-opinion ends.
   */
  groups?: { heading: string; pairs: { label: string; time: string }[] }[];
}

/** Muted headings for a fast block's groups; all optional (bare pairs otherwise). */
export interface FastBlockLabels {
  start?: string;
  ends?: string;
  chatzos?: string;
}

/**
 * The once-or-twice-a-month facts for the days on one printed page: the fast
 * bookends of any fast day, and the molad announcement. These get a footer
 * block rather than a column, because a column would be blank on 29 rows out
 * of 30 — and a page holding both 17 Tammuz and Tisha b'Av correctly yields
 * two blocks.
 */
export function pageFootnotes(
  rows: ZmanimTableRow[],
  isoOnPage: ReadonlySet<string>,
  includeFasts = true,
  labels: FastBlockLabels = {},
): PageFootnote[] {
  const lines: PageFootnote[] = [];
  // A fast that begins the previous evening (Tisha b'Av, Yom Kippur) reports
  // its start on the erev row and its end — and its NAME — on the fast day. It
  // is one event and gets one line; pairing also stops the erev row emitting a
  // bare, unlabelled time. Pairs are matched over the whole range and shown
  // when EITHER of their days is on this page, so a page break between the two
  // doesn't lose the fast.
  const pairedTail = new Set<number>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.fastStart) continue;
    const next = rows[i + 1];
    const tail = row.fastEnd ? row : next && next.fastEnd && !next.fastStart ? next : undefined;
    if (tail && tail !== row) pairedTail.add(i + 1);
  }

  // The end side prefers the labelled multi-opinion pairs when the table
  // carries them — the printed luach answers with every opinion the user
  // shows. A plain single end (no labeller) becomes one unlabelled pair.
  const endPairs = (r: ZmanimTableRow) =>
    r.fastEnds.length > 0 ? r.fastEnds : r.fastEnd ? [{ label: '', time: r.fastEnd }] : [];
  const endsGroup = (r: ZmanimTableRow) => {
    const pairs = endPairs(r);
    return pairs.length > 0 ? [{ heading: labels.ends ?? '', pairs }] : [];
  };

  // Shabbat Mevarchim rides its molad's block ("… · Shabbat Mevarchim — 8 Aug")
  // rather than the events column: it exists to announce the molad, so they
  // read as one fact. Collected first so the annotation lands on the block
  // whether the page shows the Shabbat, the Rosh Chodesh, or both.
  const mevarchimByMolad = new Map<string, string>();
  for (const row of rows) {
    if (row.molad && row.mevarchim && row.mevarchimName && isoOnPage.has(row.iso)) {
      mevarchimByMolad.set(row.molad, `${row.mevarchimName} — ${row.dayWithMonth}`);
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!includeFasts) {
      // Fast lines suppressed (the "fast times" toggle is off) — molad only.
    } else if (row.fastStart) {
      const next = rows[i + 1];
      const tail = row.fastEnd ? row : next && next.fastEnd && !next.fastStart ? next : undefined;
      if (isoOnPage.has(row.iso) || (tail && isoOnPage.has(tail.iso))) {
        // A fast paired across TWO rows began the previous evening — the
        // 25-hour fast (Tisha b'Av) — where chatzot marks the turn of the
        // day's restrictions, so the block carries it between start and end.
        const overnight = tail !== undefined && tail !== row;
        lines.push({
          label: row.holiday || tail?.holiday || '',
          text: '',
          groups: [
            { heading: labels.start ?? '', pairs: [{ label: '', time: row.fastStart }] },
            ...(overnight && tail.chatzosTime
              ? [{ heading: labels.chatzos ?? '', pairs: [{ label: '', time: tail.chatzosTime }] }]
              : []),
            ...(tail ? endsGroup(tail) : []),
          ],
        });
      }
    } else if (row.fastEnd && !pairedTail.has(i) && isoOnPage.has(row.iso)) {
      // An end with no start in range — the range itself began mid-fast.
      lines.push({ label: row.holiday, text: '', groups: endsGroup(row) });
    }
    if (row.molad && isoOnPage.has(row.iso)) {
      // The molad sentence arrives as one localized string ("Molad Av: Monday,
      // …"); its lead-up to the first colon is the block's label.
      const at = row.molad.indexOf(': ');
      const extra = mevarchimByMolad.get(row.molad);
      const text = (at > 0 ? row.molad.slice(at + 2) : row.molad) + (extra ? ` · ${extra}` : '');
      lines.push({ label: at > 0 ? row.molad.slice(0, at) : '', text });
    }
  }
  // One molad is announced on BOTH Shabbat Mevarchim and Rosh Chodesh, so the
  // same block lands twice on a page holding both. Two different molads in
  // one month differ in text and are kept.
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = JSON.stringify([line.label, line.text, line.groups ?? []]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const clock = o.plainTimes ? formatTimePlain : formatTime;
  const rows: ZmanimTableRow[] = [];
  const days = Math.min(tableDayCount(o.start, o.end), MAX_TABLE_DAYS);
  // A two-year export can hit the same month name twice, so the compact month
  // stamp carries a year only when the (possibly clamped) range needs one.
  const spansYears = o.start.startOf('day').year !== o.start.startOf('day').plus({ days: Math.max(0, days - 1) }).year;
  const monthFormat = spansYears
    ? ({ day: 'numeric', month: 'short', year: '2-digit' } as const)
    : ({ day: 'numeric', month: 'short' } as const);
  // Compute only the selected columns plus the keys the day events need — not
  // every opinion — which matters most over a long date range. Chatzot rides
  // along for the Tisha b'Av footnote.
  const computeKeys = new Set([...keys, ...dayEventZmanKeys(havdalahZmanKey(havdalahOpinion)), 'chatzos']);

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
      keys: computeKeys,
    });
    const zmanim = o.lehumra ? applyLehumra(computed) : computed;
    const byKey = new Map(zmanim.map((z) => [z.key, z]));

    const info = getDayInfo(date, formatter, o.locale, o.location.inIsrael);
    const holiday = localizedHolidayLabel(o.locale, info.label, info.yomTovIndex, info.dayOfChanukah) ?? '';

    // Same event set as the calendar cells — the USER's fast-end opinions, the
    // per-event lehumra rounding directions.
    const timeByKey = Object.fromEntries(zmanim.map((z) => [z.key, z.time]));
    const allEvents = getDayEvents(
      date,
      {
        candleLighting: timeByKey.candleLighting,
        sunset: timeByKey.sunset,
        havdalah: havdalahTime(havdalahOpinion, timeByKey),
        zmanimByKey: timeByKey,
      },
      o.location.inIsrael,
      o.hiddenFastEnd ?? DEFAULT_HIDDEN_FAST_END,
    );
    const adjusted = o.lehumra ? applyLehumraToEvents(allEvents) : allEvents;
    // One fast-end slot for the tabular cell: the earliest opinion that HAS a
    // time (on a short night the degree opinions are null and the fixed-minute
    // fallback wins). The labelled detail keeps every visible opinion.
    const fastEnds = adjusted.filter((e) => e.type === 'fastEnd');
    const chosenFastEnd = fastEnds.find((e) => e.time) ?? fastEnds[0];
    const events = adjusted.filter((e) => e.type !== 'fastEnd' || e === chosenFastEnd);
    const eventTime = (type: string) => {
      const e = events.find((ev) => ev.type === type);
      return e ? clock(e.time, o.locale) : '';
    };
    const fastEndPairs = o.fastEndLabel
      ? fastEnds
          .filter((e) => e.time)
          .map((e) => ({ label: o.fastEndLabel!(e.zmanKey ?? ''), time: clock(e.time, o.locale) }))
      : [];

    // Every learning key present as a column, empty by default; only the
    // requested cycles are filled (the lookup is skipped when none are asked for).
    const learning = Object.fromEntries(LEARNING_CYCLE_KEYS.map((k) => [k, ''])) as Record<LearningCycleKey, string>;
    if (learningKeys.length > 0) {
      const requested = new Set(learningKeys);
      for (const item of getDailyLearning(date, o.location.inIsrael, o.locale)) {
        if (requested.has(item.key)) learning[item.key] = item.reading;
      }
    }

    const jewish = new JewishDate(date);
    rows.push({
      iso: date.toISODate() ?? '',
      dateLabel: date.setLocale(o.locale).toLocaleString({ year: 'numeric', month: 'numeric', day: 'numeric' }),
      dayWithMonth: date.setLocale(o.locale).toLocaleString(monthFormat),
      dayOfMonth: String(date.day),
      weekday: date.setLocale(o.locale).toLocaleString({ weekday: 'short' }),
      hebrewDate: `${info.hebrewDayOfMonth} ${info.hebrewMonth}`,
      hebrewDay: String(info.hebrewDayOfMonth),
      hebrewMonthId: `${jewish.getJewishYear()}-${String(jewish.getJewishMonth()).padStart(2, '0')}`,
      holiday,
      parsha: [info.parsha, info.specialShabbos ? specialShabbat(info.specialShabbos) : null]
        .filter(Boolean)
        .join(' · '),
      candleLighting: eventTime('candle'),
      havdalah: eventTime('havdalah'),
      fastStart: eventTime('fastStart'),
      fastEnd: eventTime('fastEnd'),
      fastEnds: fastEndPairs,
      chatzosTime: byKey.get('chatzos')?.time ? clock(byKey.get('chatzos')!.time, o.locale) : '',
      mevarchim: info.isShabbosMevorchim ? '\u2713' : '',
      mevarchimName: info.isShabbosMevorchim ? (o.mevarchimLabel ?? '') : '',
      molad:
        info.molad && o.moladLabel
          ? o.moladLabel({
              // The month the molad announces is the INCOMING one (a molad
              // announced in Tammuz is Av's), so it is resolved from the
              // molad's own month-start, not from this row's date.
              month: getDayInfo(info.molad.monthDate, formatter, o.locale, o.location.inIsrael).hebrewMonth,
              // Spelled out, not abbreviated: this rides a page footer with room
              // to spare, unlike the per-row date column.
              date: info.molad.date.setLocale(o.locale).toLocaleString({ day: 'numeric', month: 'long' }),
              ...formatMoladParts(info.molad, o.locale),
              chalakim: info.molad.chalakim,
            })
          : '',
      omer: info.omer > 0 ? String(info.omer) : '',
      cells: keys.map((key) => {
        const z = byKey.get(key);
        if (!z) return '—';
        return z.duration ? formatDuration(z.durationMillis) : clock(z.time, o.locale);
      }),
      ...learning,
    });
  }

  return { keys, rows };
}
