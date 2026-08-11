import { DateTime } from 'luxon';

import { computeZmanim } from './zmanim';

/**
 * The worked examples on the help page.
 *
 * Every number shown there is COMPUTED by the real engine at render time, never
 * written into the prose. A hand-typed "16.1° falls 7 seconds after 90 minutes"
 * would become a lie the first time a definition or a rounding changed, and the
 * help page is the last place that can afford to disagree with the panel.
 *
 * The anchors are fixed places and fixed calendar dates, but the YEAR is the
 * current one (`anchorDate`), so the page never reads as stale. The phenomena
 * they demonstrate are structural — the degree/minute coincidence at Jerusalem's
 * equinox, the missing deep angles on a northern midsummer night — so they hold
 * in any year.
 */
export interface HelpAnchor {
  lat: number;
  lng: number;
  timeZoneId: string;
  /** Calendar month (1-12) and day, taken in the anchor's own zone. */
  month: number;
  day: number;
}

/**
 * Jerusalem at the March equinox — the place and season in which the degree
 * opinions were matched to their minute nicknames (see docs/zmanim.md).
 */
export const EQUINOX_ANCHOR: HelpAnchor = {
  lat: 31.7683,
  lng: 35.2137,
  timeZoneId: 'Asia/Jerusalem',
  month: 3,
  day: 20,
};

/**
 * Düsseldorf at the summer solstice — the short-night case pinned by
 * calculator.shortnight.test.ts, where the 16.1°/18°/19.8° dawns have no time
 * and their fixed- and seasonal-minute neighbours still resolve.
 */
export const SHORT_NIGHT_ANCHOR: HelpAnchor = {
  lat: 51.2277,
  lng: 6.7735,
  timeZoneId: 'Europe/Berlin',
  month: 6,
  day: 21,
};

/**
 * The degree opinion and the fixed-minute opinion that names it. At the equinox
 * anchor each pair lands seconds apart — which is the entire reason 16.1° is
 * called "the 72-minute dawn" — and the table shows that rather than asserting it.
 */
export const EQUINOX_PAIRS: readonly { degrees: string; minutes: string }[] = [
  { degrees: 'alos198', minutes: 'alos90' },
  { degrees: 'alosHashachar', minutes: 'alos72' },
  { degrees: 'tzais161', minutes: 'tzais72' },
];

/**
 * Dawn opinions on the short-night morning, in the order they are DEFINED (not
 * by time): the three degree opinions that come up blank, then the fixed and
 * seasonal ones that do not — including the seasonal dawn, which stretches so
 * far in midsummer that it precedes the fixed-90 one.
 */
export const SHORT_NIGHT_KEYS: readonly string[] = [
  'alos198',
  'alos18',
  'alosHashachar',
  'alos90',
  'alos72',
  'alos72Zmanis',
];

/** The anchor's date in the current year, built from components in its own zone. */
export function anchorDate(anchor: HelpAnchor, now: DateTime = DateTime.now()): DateTime {
  return DateTime.fromObject(
    { year: now.setZone(anchor.timeZoneId).year, month: anchor.month, day: anchor.day, hour: 12 },
    { zone: anchor.timeZoneId },
  );
}

/** Compute an anchor's zmanim, keyed for lookup by zman key. */
export function anchorZmanim(anchor: HelpAnchor, keys: readonly string[]): Map<string, DateTime | null> {
  const computed = computeZmanim({
    lat: anchor.lat,
    lng: anchor.lng,
    date: anchorDate(anchor),
    timeZoneId: anchor.timeZoneId,
    keys,
  });
  return new Map(computed.map((z) => [z.key, z.time]));
}

/** Whole seconds between two times, or null when either has none. */
export function gapSeconds(a: DateTime | null, b: DateTime | null): number | null {
  if (!a || !b) return null;
  return Math.round(Math.abs(a.diff(b).as('seconds')));
}
