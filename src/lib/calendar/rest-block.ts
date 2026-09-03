import { JewishCalendar } from 'kosher-zmanim';
import type { DateTime } from 'luxon';

/**
 * Is this day a work-prohibited Yom Tov — the reason a day that is not Shabbat
 * can be a rest day, and the only ground on which a rest day should be named
 * by its festival?
 *
 * Deliberately NOT the formatter's significant-day label: that also names Erev
 * Yom Tov, Chol Hamoed and Isru Chag, so a Shabbat carrying one of those would
 * be named by the neighbouring festival rather than as Shabbat. And NOT the
 * broad isYomTov(), which is true for Purim and Chanukah.
 */
export function isYomTovRestDay(date: DateTime, inIsrael: boolean): boolean {
  const jc = new JewishCalendar(date);
  jc.setInIsrael(inIsrael); // 1- vs 2-day Yom Tov
  return jc.isYomTovAssurBemelacha();
}

/** Is this a Shabbat or a work-prohibited Yom Tov (a "rest day")? */
export function isRestDay(date: DateTime, inIsrael: boolean): boolean {
  return date.weekday === 6 || isYomTovRestDay(date, inIsrael); // Luxon: Saturday === 6
}

/** A run of consecutive rest days, with the eve that lights its first candles. */
export interface RestBlock {
  /** The day before the block — its candle lighting is the classic sunset − offset. */
  erev: DateTime;
  firstRest: DateTime;
  lastRest: DateTime;
  /**
   * More than one rest day, so the block lights candles more than once: the 2nd
   * Yom Tov night and Yom Tov on Motzei Shabbat light after nightfall from an
   * existing flame, Shabbat after a Friday Yom Tov keeps the pre-sunset time.
   */
  multiDay: boolean;
}

/**
 * The contiguous rest block (Shabbat / Yom Tov, and any run of them) a day
 * belongs to — or, on a mundane day, the block starting tomorrow, so an eve
 * shows the times of the rest days it leads into. Null when neither applies.
 */
export function restBlockFor(date: DateTime, inIsrael: boolean): RestBlock | null {
  let firstRest: DateTime;
  if (isRestDay(date, inIsrael)) {
    firstRest = date;
  } else if (isRestDay(date.plus({ days: 1 }), inIsrael)) {
    firstRest = date.plus({ days: 1 });
  } else {
    return null;
  }
  while (isRestDay(firstRest.minus({ days: 1 }), inIsrael)) firstRest = firstRest.minus({ days: 1 });
  let lastRest = firstRest;
  while (isRestDay(lastRest.plus({ days: 1 }), inIsrael)) lastRest = lastRest.plus({ days: 1 });
  return {
    erev: firstRest.minus({ days: 1 }),
    firstRest,
    lastRest,
    multiDay: lastRest.toMillis() > firstRest.toMillis(),
  };
}
