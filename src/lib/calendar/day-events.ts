import { JewishCalendar } from 'kosher-zmanim';
import type { DateTime } from 'luxon';

export type DayEventType = 'candle' | 'havdalah' | 'fastStart' | 'fastEnd';

/** The tzeit opinions a fast end is shown at, earliest to latest. */
export const FAST_END_OPINIONS = ['tzaisGeonim', 'tzais', 'tzais42'] as const;
export type FastEndOpinion = (typeof FAST_END_OPINIONS)[number];

export interface DayEvent {
  type: DayEventType;
  time: DateTime | null;
  /**
   * The tzeit opinion this time uses — set on fastEnd events only, which are
   * emitted once per FAST_END_OPINIONS entry. Translatable via zmanim.shitot.
   */
  zmanKey?: FastEndOpinion;
}

/** The zmanim a day's events can reference. */
export interface DayEventTimes {
  candleLighting: DateTime | null;
  alos: DateTime | null;
  sunset: DateTime | null;
  /** Nightfall of the Geonim (5.95°) — the earliest fast-end opinion. */
  tzaisGeonim: DateTime | null;
  /** Standard nightfall (8.5°). */
  tzais: DateTime | null;
  /** Fixed 42 minutes after sunset — the latest fast-end opinion. */
  tzais42: DateTime | null;
  /** Nightfall for havdalah, per the user's chosen opinion (may differ from `tzais`). */
  havdalah: DateTime | null;
}

/**
 * Compute the candle-lighting / havdalah / fast events to surface on a calendar
 * day. Pure and deterministic so it can be unit-tested.
 *
 * - Candle lighting: Erev Shabbat (Friday) or Erev Yom Tov.
 * - Havdalah: the night Shabbat or Yom Tov ends (when the next day is mundane).
 * - Fast begins/ends: minor fasts run dawn→nightfall; Yom Kippur & Tisha B'Av
 *   start the previous evening (shown as candle lighting / sunset on the eve)
 *   and end at nightfall.
 */
export function getDayEvents(date: DateTime, times: DayEventTimes, inIsrael = false): DayEvent[] {
  const jc = new JewishCalendar(date);
  jc.setInIsrael(inIsrael);
  const tomorrow = date.plus({ days: 1 });
  const jcTomorrow = new JewishCalendar(tomorrow);
  jcTomorrow.setInIsrael(inIsrael);

  const isFriday = date.weekday === 5;
  const isSaturday = date.weekday === 6;
  // "Rest day" = Shabbat or a work-prohibited Yom Tov. Use isYomTovAssurBemelacha
  // (NOT the broad isYomTov, which also reports Purim/Chanukah).
  const tomorrowIsRest = tomorrow.weekday === 6 || jcTomorrow.isYomTovAssurBemelacha();
  const idx = jc.getYomTovIndex();
  const YOM_KIPPUR = JewishCalendar.YOM_KIPPUR;
  const TISHA_BEAV = JewishCalendar.TISHA_BEAV;

  const events: DayEvent[] = [];

  // Candle lighting before Shabbat / Yom Tov begins tonight.
  if (isFriday || jc.isErevYomTov()) {
    events.push({ type: 'candle', time: times.candleLighting });
  }

  // Tisha B'Av has no candle lighting, so surface its onset (sunset) on the eve.
  if (jcTomorrow.getYomTovIndex() === TISHA_BEAV) {
    events.push({ type: 'fastStart', time: times.sunset });
  }

  // Havdalah on the night Shabbat / Yom Tov ends — at the chosen tzeit opinion.
  const endsTonight = (isSaturday || jc.isYomTovAssurBemelacha()) && !tomorrowIsRest;
  if (endsTonight) {
    events.push({ type: 'havdalah', time: times.havdalah });
  }

  // Fast begins/ends on the fast day itself.
  if (jc.isTaanis()) {
    if (idx !== YOM_KIPPUR && idx !== TISHA_BEAV) {
      events.push({ type: 'fastStart', time: times.alos });
    }
    // Yom Kippur's end is already shown as havdalah; avoid a duplicate nightfall.
    // The end is given at all three tzeit opinions — displays that only have
    // room for one (the calendar grid) keep the earliest (Geonim 5.95°).
    if (!endsTonight) {
      for (const zmanKey of FAST_END_OPINIONS) {
        events.push({ type: 'fastEnd', time: times[zmanKey], zmanKey });
      }
    }
  }

  return events;
}
