/**
 * Date-range limits shared by the export tools' From/To pickers, so a range
 * can never be reversed or longer than a tool's cap. The tools still validate
 * before exporting; these keep the pickers from offering an invalid range in
 * the first place.
 */

import { DateTime } from 'luxon';

/** The last end date a range starting at `startIso` may have, or '' for an invalid start. */
export function rangeLatestEnd(startIso: string, maxDays: number): string {
  const start = DateTime.fromISO(startIso);
  return start.isValid ? (start.plus({ days: maxDays - 1 }).toISODate() ?? '') : '';
}

/**
 * The end date once the start has moved: unchanged while it still fits (not
 * before the start, within `maxDays`); otherwise the range keeps its previous
 * length from the new start, within the cap.
 */
export function fitRangeEnd(startIso: string, endIso: string, previousDays: number, maxDays: number): string {
  const start = DateTime.fromISO(startIso);
  if (!start.isValid) return endIso;
  const end = DateTime.fromISO(endIso);
  const latest = start.plus({ days: maxDays - 1 });
  if (end.isValid && end >= start && end <= latest) return endIso;
  const days = Math.min(Math.max(previousDays, 1), maxDays);
  return start.plus({ days: days - 1 }).toISODate() ?? endIso;
}

/**
 * For a range snapped to whole months (`span` gives a day's month): the end,
 * pulled back to the last whole month that still fits within `maxDays` of the
 * start. Snapping a near-cap range outward to month boundaries can otherwise
 * overshoot the cap by up to a month.
 */
export function wholeMonthEndWithin(
  start: DateTime,
  end: DateTime,
  maxDays: number,
  span: (day: DateTime) => { start: DateTime; end: DateTime },
): DateTime {
  const latest = start.startOf('day').plus({ days: maxDays - 1 });
  if (end.startOf('day') <= latest) return end;
  const month = span(latest);
  return month.end.startOf('day') <= latest ? month.end : month.start.minus({ days: 1 });
}
