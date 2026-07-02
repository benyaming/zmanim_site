import type { JewishDate } from 'kosher-zmanim';
import { DateTime } from 'luxon';

/**
 * Convert a kosher-zmanim `JewishDate` into a Luxon `DateTime` in **this app's**
 * Luxon instance, anchored at local midnight.
 *
 * kosher-zmanim bundles its own copy of Luxon, so `JewishDate.getDate()` returns a
 * DateTime whose zone object comes from that copy. Cross-instance operations like
 * `DateTime#hasSame` then silently return the wrong answer against our Luxon (a
 * same-instant date reports as a *different* day), which is why Hebrew-mode cells
 * never matched "today"/the selected day. Rebuilding from plain calendar
 * components severs the foreign Luxon so every date the calendar emits compares
 * cleanly with `DateTime.now()` and the selected day.
 */
export function jewishToLocalDay(jd: JewishDate): DateTime {
  const d = jd.getDate();
  return DateTime.fromObject({ year: d.year, month: d.month, day: d.day }).startOf('day');
}
