import { JewishCalendar } from 'kosher-zmanim';
import { DateTime } from 'luxon';

/**
 * The molad (mean lunar conjunction) of a Jewish month, in the traditional
 * announcement form: the civil date it falls on plus the time of day broken
 * into hours, minutes and chalakim (1 minute = 18 chalakim). Times are
 * Jerusalem local mean time, as customarily announced — they are NOT converted
 * to the user's location.
 */
export interface MoladInfo {
  /** Civil date the molad falls on (local-midnight anchored, for weekday/date display). */
  date: DateTime;
  /**
   * Civil date of the 1st of the Jewish month this molad ANNOUNCES — i.e. the
   * incoming month, not the one the announcement is made in. Callers that need
   * to name that month (a print sheet spanning several) resolve it from here;
   * keeping it a date rather than a name leaves this module locale-free.
   */
  monthDate: DateTime;
  /** Hour of that civil day, 0-23. */
  hours: number;
  /** Minutes past the hour, 0-59. */
  minutes: number;
  /** Remaining chalakim (parts), 0-17. */
  chalakim: number;
}

/**
 * The molad of the Jewish month that begins on/after `date`. `date` is expected
 * to be a Rosh Chodesh day or a day shortly before one (e.g. Shabbat
 * Mevorchim); the walk finds the next 1st of a Jewish month, so on a 30th
 * (first day of a two-day Rosh Chodesh) it correctly reports the INCOMING
 * month's molad, not the outgoing one's.
 *
 * The molad JewishDate is rebuilt into this app's Luxon instance (kosher-zmanim
 * bundles its own copy — see `jewishToLocalDay` for the failure mode).
 */
export function getMolad(date: DateTime): MoladInfo {
  let day = date;
  let jc = new JewishCalendar(day);
  while (jc.getJewishDayOfMonth() !== 1) {
    day = day.plus({ days: 1 });
    jc = new JewishCalendar(day);
  }
  const molad = jc.getMolad();
  return {
    date: DateTime.fromObject({
      year: molad.getGregorianYear(),
      month: molad.getGregorianMonth() + 1, // kosher-zmanim months are 0-based
      day: molad.getGregorianDayOfMonth(),
    }),
    // Rebuilt from components rather than handing back the walked DateTime, so
    // the same molad reported from Rosh Chodesh and from Shabbat Mevorchim is
    // structurally identical (the walk reaches the two by different routes).
    monthDate: DateTime.fromObject({ year: day.year, month: day.month, day: day.day }),
    hours: molad.getMoladHours(),
    minutes: molad.getMoladMinutes(),
    chalakim: molad.getMoladChalakim(),
  };
}
