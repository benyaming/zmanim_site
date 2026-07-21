import { JewishCalendar } from 'kosher-zmanim';
import type { DateTime } from 'luxon';

import { DEFAULT_HIDDEN_FAST_END, FAST_END_FALLBACK, FAST_END_OPINIONS, FAST_END_ZMAN_KEYS } from './fast-end';

export type DayEventType = 'candle' | 'havdalah' | 'fastStart' | 'fastEnd';

/**
 * The fast-START opinions, in preference order.
 *
 * A minor fast begins at dawn — but WHICH dawn matters at high latitude, where
 * the 16.1° dawn can have no time at all (the sun never reaches that angle on a
 * short summer night). We then offer the fixed-72-minute dawn, the opinion
 * myzmanim publishes as "dawn fixed minutes" in exactly this situation.
 *
 * The emitted event names the opinion that produced its time (`zmanKey`), so a
 * fixed-minute number is never displayed under a degree-based label. Which dawn
 * a short-night location should actually keep is an open machloket — the app
 * reports what each shita says and does not rule between them.
 */
const FAST_START_ZMAN_KEYS = ['alosHashachar', 'alos72'] as const;

/**
 * The minimal set of zman keys getDayEvents reads, for callers that only need
 * event times (the calendar grid, month/table exports) to pass as
 * `computeZmanim({ keys })` — so they don't compute every opinion. `havdalahKey`
 * is the chosen havdalah opinion's zman key (`havdalahZmanKey(opinion)`).
 */
export function dayEventZmanKeys(havdalahKey: string): Set<string> {
  return new Set([
    'candleLighting',
    'sunset',
    ...FAST_START_ZMAN_KEYS,
    ...FAST_END_ZMAN_KEYS,
    havdalahKey,
  ]);
}

export interface DayEvent {
  type: DayEventType;
  time: DateTime | null;
  /**
   * The opinion this time comes from.
   *
   * On `fastEnd` — emitted once per visible opinion for the fast's severity —
   * it is the fast-end opinion key, translatable via `events.fastEndOpinions`.
   * On `fastStart` it is the zman key that supplied the time (see
   * FAST_START_ZMAN_KEYS), translatable via `zmanim.shitot`, so the row always
   * says which dawn it is showing. Absent on Tisha B'Av's sunset onset, and on
   * candle/havdalah events.
   */
  zmanKey?: string;
  /**
   * Candle lighting that must wait for the current rest day to end (the 2nd
   * Yom Tov night, or Yom Tov beginning on Motzei Shabbat): nightfall per the
   * chosen havdalah opinion, lit from an existing flame. "Not before" — so
   * lehumra rounds it UP, unlike a regular pre-sunset lighting.
   */
  afterNightfall?: boolean;
}

/** The zmanim a day's events can reference. */
export interface DayEventTimes {
  candleLighting: DateTime | null;
  /** Sunset — Tisha B'Av onset, and the base for fixed-minute fast-end poskim. */
  sunset: DateTime | null;
  /**
   * Nightfall per the user's chosen havdalah opinion (may differ from `tzais`).
   * Also the second-night candle-lighting time — lighting for a rest day that
   * follows another rest day waits for the first one to end.
   */
  havdalah: DateTime | null;
  /**
   * Computed zman times keyed by zman key. Both fast bookends read from here —
   * the start via FAST_START_ZMAN_KEYS, each end opinion via its `zmanKey`.
   * Pass the full `byKey` map (at least `dayEventZmanKeys(...)`'s worth).
   */
  zmanimByKey: Record<string, DateTime | null>;
}

/**
 * Compute the candle-lighting / havdalah / fast events to surface on a calendar
 * day. Pure and deterministic so it can be unit-tested.
 *
 * - Candle lighting: every night a rest day begins — from a mundane eve at
 *   sunset − offset; from a rest day (2nd Yom Tov night, Yom Tov on Motzei
 *   Shabbat) at nightfall, from an existing flame.
 * - Havdalah: the night Shabbat or Yom Tov ends (when the next day is mundane).
 * - Fast begins/ends: minor fasts run dawn→nightfall; Yom Kippur & Tisha B'Av
 *   start the previous evening (shown as candle lighting / sunset on the eve)
 *   and end at nightfall. A fast's end is shown at each visible opinion for its
 *   severity (gmar-taanis medium stars for minor fasts, nightfall for Tisha
 *   B'Av); `hiddenFastEnd` is the user's hide-list (see fast-end.ts).
 */
export function getDayEvents(
  date: DateTime,
  times: DayEventTimes,
  inIsrael = false,
  hiddenFastEnd: readonly string[] = DEFAULT_HIDDEN_FAST_END,
): DayEvent[] {
  const jc = new JewishCalendar(date);
  jc.setInIsrael(inIsrael);
  const tomorrow = date.plus({ days: 1 });
  const jcTomorrow = new JewishCalendar(tomorrow);
  jcTomorrow.setInIsrael(inIsrael);

  const isSaturday = date.weekday === 6;
  // "Rest day" = Shabbat or a work-prohibited Yom Tov. Use isYomTovAssurBemelacha
  // (NOT the broad isYomTov, which also reports Purim/Chanukah).
  const todayIsRest = isSaturday || jc.isYomTovAssurBemelacha();
  const tomorrowIsRest = tomorrow.weekday === 6 || jcTomorrow.isYomTovAssurBemelacha();
  const idx = jc.getYomTovIndex();
  const YOM_KIPPUR = JewishCalendar.YOM_KIPPUR;
  const TISHA_BEAV = JewishCalendar.TISHA_BEAV;

  const events: DayEvent[] = [];

  // Candle lighting the night a rest day begins. From a mundane eve it's the
  // classic sunset − offset. When today is itself a rest day (2nd Yom Tov
  // night, or Yom Tov starting on Motzei Shabbat) lighting waits for today to
  // end — nightfall per the chosen havdalah opinion, from an existing flame —
  // EXCEPT when the coming rest day is Shabbat (Yom Tov on Friday): Shabbat
  // candles must precede sunset, so the pre-sunset time applies even then.
  // Mirrors zmanim_api's yom tov engine (tzais(havdala_params) vs candle_lighting()).
  if (tomorrowIsRest) {
    if (todayIsRest && tomorrow.weekday !== 6) {
      events.push({ type: 'candle', time: times.havdalah, afterNightfall: true });
    } else {
      events.push({ type: 'candle', time: times.candleLighting });
    }
  }

  // Tisha B'Av has no candle lighting, so surface its onset (sunset) on the eve.
  if (jcTomorrow.getYomTovIndex() === TISHA_BEAV) {
    events.push({ type: 'fastStart', time: times.sunset });
  }

  // Havdalah on the night Shabbat / Yom Tov ends — at the chosen tzeit opinion.
  const endsTonight = todayIsRest && !tomorrowIsRest;
  if (endsTonight) {
    events.push({ type: 'havdalah', time: times.havdalah });
  }

  // Fast begins/ends on the fast day itself.
  if (jc.isTaanis()) {
    if (idx !== YOM_KIPPUR && idx !== TISHA_BEAV) {
      // The first dawn opinion that has a time today, named on the event. At
      // most latitudes that is the 16.1° dawn; on a short night it is the
      // fixed-72-minute one. Both null (a polar day) emits a null-time row, as
      // every other event does.
      const zmanKey =
        FAST_START_ZMAN_KEYS.find((k) => times.zmanimByKey[k]) ?? FAST_START_ZMAN_KEYS[0];
      events.push({ type: 'fastStart', time: times.zmanimByKey[zmanKey] ?? null, zmanKey });
    }
    // Yom Kippur's end is already shown as havdalah; avoid a duplicate nightfall.
    // Every other fast — minor or Tisha B'Av alike — emits each visible fast-end
    // opinion; a display with room for one (the grid) keeps the earliest that
    // has a time.
    if (!endsTonight) {
      const hidden = new Set(hiddenFastEnd);
      const ends: DayEvent[] = [];
      for (const op of FAST_END_OPINIONS) {
        if (hidden.has(op.key)) continue;
        ends.push({ type: 'fastEnd', time: times.zmanimByKey[op.zmanKey] ?? null, zmanKey: op.key });
      }
      // Short night: every visible degree-based opinion is unreached, so the
      // fast would show no end time at all. Fall through to the fixed-minute
      // Rabbeinu Tam nightfall, labelled, so a real end always appears — the
      // same choice made for the fast start. Skipped if it's already visible,
      // or itself undefined (a true polar day, where nothing can anchor it).
      if (ends.length > 0 && !ends.some((e) => e.time)) {
        const fbTime = times.zmanimByKey[FAST_END_FALLBACK.zmanKey] ?? null;
        if (fbTime && !ends.some((e) => e.zmanKey === FAST_END_FALLBACK.key)) {
          ends.push({ type: 'fastEnd', time: fbTime, zmanKey: FAST_END_FALLBACK.key });
        }
      }
      events.push(...ends);
    }
  }

  return events;
}
