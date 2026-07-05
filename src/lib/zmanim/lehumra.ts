import type { DateTime } from 'luxon';

import type { ComputedZman } from './types';

/**
 * Lehumra (stringent) display rounding, ported from the companion
 * `zmanim_bot` (`LEHUMRA_MINUS_MINUTE_NAMES` in its zmanim models): every
 * displayed time is rounded to a whole minute toward the SAFE side, so acting
 * on the displayed minute can never be lenient versus the exact computed time.
 *
 * - `'earlier'` — deadlines ("until" times: sof zman Shema/Tefila, the chametz
 *   deadlines, sunset, candle lighting, a fast's start): round DOWN.
 * - `'later'` — onsets ("from" times: alot, misheyakir, netz, tzeit, havdalah,
 *   a fast's end): round UP.
 *
 * Purely a display transform — raw calculations (and their golden tests) are
 * untouched; callers opt in per the user's setting.
 */
export type LehumraDirection = 'earlier' | 'later';

/** Zman keys whose displayed time is a deadline — lehumra rounds them down. */
const EARLIER_KEYS: ReadonlySet<string> = new Set([
  'sofZmanShmaMGA',
  'sofZmanShmaGRA',
  'sofZmanTfilaMGA',
  'sofZmanTfilaGRA',
  'sofZmanAchilasChametzMGA',
  'sofZmanAchilasChametzGRA',
  'sofZmanBiurChametzMGA',
  'sofZmanBiurChametzGRA',
  'sunset',
  'candleLighting',
]);

/** The stringent rounding direction for a zman key. */
export function zmanLehumraDirection(key: string): LehumraDirection {
  return EARLIER_KEYS.has(key) ? 'earlier' : 'later';
}

/** Round a time to a whole minute in the given stringent direction. */
export function roundTimeLehumra(time: DateTime, direction: LehumraDirection): DateTime;
export function roundTimeLehumra(time: DateTime | null, direction: LehumraDirection): DateTime | null;
export function roundTimeLehumra(time: DateTime | null, direction: LehumraDirection): DateTime | null {
  if (!time) return null;
  const floor = time.startOf('minute');
  if (direction === 'earlier') return floor;
  // Already exact to the minute → nothing to round up.
  return floor.equals(time) ? time : floor.plus({ minutes: 1 });
}

/** Apply lehumra rounding to a computed zmanim list (display only). */
export function applyLehumra(zmanim: ComputedZman[]): ComputedZman[] {
  return zmanim.map((z) => ({ ...z, time: roundTimeLehumra(z.time, zmanLehumraDirection(z.key)) }));
}

/**
 * Stringent direction per day-event type. Matches the bot: a fast STARTS
 * earlier (even though its clock time is alot/sunset, whose standalone rows
 * round up/down respectively) and ends later; candles in, havdalah out.
 * Exception: an after-nightfall candle lighting (2nd Yom Tov night, Motzei
 * Shabbat) is a "not before" time — it rounds UP, like the bot's second-day
 * candle_lighting.
 */
const EVENT_DIRECTION: Record<string, LehumraDirection> = {
  candle: 'earlier',
  fastStart: 'earlier',
  havdalah: 'later',
  fastEnd: 'later',
};

/** Apply lehumra rounding to day events (candle / havdalah / fast times). */
export function applyLehumraToEvents<T extends { type: string; time: DateTime | null; afterNightfall?: boolean }>(
  events: T[],
): T[] {
  return events.map((e) => ({
    ...e,
    time: roundTimeLehumra(e.time, e.afterNightfall ? 'later' : (EVENT_DIRECTION[e.type] ?? 'later')),
  }));
}
