import { JewishCalendar } from 'kosher-zmanim';
import type { DateTime } from 'luxon';

import { DEFAULT_HIDDEN_FAST_END, FAST_END_ZMAN_KEYS, fastEndOpinionsFor } from './fast-end';

export type DayEventType = 'candle' | 'havdalah' | 'fastStart' | 'fastEnd';

/**
 * The minimal set of zman keys getDayEvents reads, for callers that only need
 * event times (the calendar grid, month/table exports) to pass as
 * `computeZmanim({ keys })` — so they don't compute every opinion. `havdalahKey`
 * is the chosen havdalah opinion's zman key (`havdalahZmanKey(opinion)`).
 */
export function dayEventZmanKeys(havdalahKey: string): Set<string> {
  return new Set(['candleLighting', 'alosHashachar', 'sunset', ...FAST_END_ZMAN_KEYS, havdalahKey]);
}

export interface DayEvent {
  type: DayEventType;
  time: DateTime | null;
  /**
   * The fast-end opinion this time uses — set on fastEnd events only, which are
   * emitted once per visible opinion for the fast's severity. Translatable via
   * `events.fastEndOpinions`.
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
  alos: DateTime | null;
  /** Sunset — Tisha B'Av onset, and the base for fixed-minute fast-end poskim. */
  sunset: DateTime | null;
  /**
   * Nightfall per the user's chosen havdalah opinion (may differ from `tzais`).
   * Also the second-night candle-lighting time — lighting for a rest day that
   * follows another rest day waits for the first one to end.
   */
  havdalah: DateTime | null;
  /**
   * Computed zman times keyed by zman key — degree-based fast-end opinions
   * (tzaisGeonim, tzaisGeonim645, tzaisGeonim7083, tzais, tzais42, tzais72) read
   * their time from here. Pass the full `byKey` map.
   */
  tzeitByKey: Record<string, DateTime | null>;
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
      events.push({ type: 'fastStart', time: times.alos });
    }
    // Yom Kippur's end is already shown as havdalah; avoid a duplicate nightfall.
    // Tisha B'Av (a major fast) ends only at nightfall (three small stars); a
    // minor fast may also end at the lenient gmar-taanis (three medium stars).
    // Each visible opinion is emitted; a display with room for one (the grid)
    // keeps the earliest.
    if (!endsTonight) {
      const hidden = new Set(hiddenFastEnd);
      for (const op of fastEndOpinionsFor(idx === TISHA_BEAV)) {
        if (hidden.has(op.key)) continue;
        events.push({ type: 'fastEnd', time: times.tzeitByKey[op.zmanKey] ?? null, zmanKey: op.key });
      }
    }
  }

  return events;
}
