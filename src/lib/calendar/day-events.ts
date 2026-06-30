import { JewishCalendar } from 'kosher-zmanim';
import type { DateTime } from 'luxon';

export type DayEventType = 'candle' | 'havdalah' | 'fastStart' | 'fastEnd';

export interface DayEvent {
  type: DayEventType;
  time: DateTime | null;
}

/** The zmanim a day's events can reference. */
export interface DayEventTimes {
  candleLighting: DateTime | null;
  alos: DateTime | null;
  sunset: DateTime | null;
  tzais: DateTime | null;
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

  // Havdalah on the night Shabbat / Yom Tov ends.
  const endsTonight = (isSaturday || jc.isYomTovAssurBemelacha()) && !tomorrowIsRest;
  if (endsTonight) {
    events.push({ type: 'havdalah', time: times.tzais });
  }

  // Fast begins/ends on the fast day itself.
  if (jc.isTaanis()) {
    if (idx !== YOM_KIPPUR && idx !== TISHA_BEAV) {
      events.push({ type: 'fastStart', time: times.alos });
    }
    // Yom Kippur's end is already shown as havdalah; avoid a duplicate nightfall.
    if (!endsTonight) {
      events.push({ type: 'fastEnd', time: times.tzais });
    }
  }

  return events;
}
