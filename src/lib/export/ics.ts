/**
 * RFC 5545 serializer for the calendar export — hand-written like csv.ts, and
 * pure, so a server-side feed renderer can reuse it unchanged.
 *
 * Deliberate omissions:
 * - No METHOD: `METHOD:PUBLISH` invokes iTIP, which requires an ORGANIZER this
 *   file doesn't have (RFC 5546 §3.2.1). A plain calendar collection is right.
 * - No SEQUENCE: it is a revision counter (RFC 5545 §3.8.7.4) and a one-time
 *   file has no revision history.
 * - No DTEND on timed events: each is a point in time. DTEND equal to DTSTART
 *   is not allowed (§3.8.2.2), so it is omitted rather than faked.
 *
 * Alerts are the user's choice, one for timed events and one for all-day
 * events; with none chosen the file carries no VALARM at all — though the
 * calendar app may still apply its own default notifications.
 */

import type { DateTime } from 'luxon';

import { SITE_HOST } from '@/lib/site';

import type { CalendarEvent } from './calendar-events';
import { ICS_ALL_DAY_ALERTS, type IcsAlerts, NO_ICS_ALERTS } from './ics-preset';

export interface IcsDocument {
  /** Suggested calendar name (X-WR-CALNAME); clients may ignore it. */
  name: string;
  events: readonly CalendarEvent[];
  /** DTSTAMP for every event: the export time for a download. */
  stamp: DateTime;
  /** Alerts to attach; absent = none. */
  alerts?: IcsAlerts;
}

/** An RFC 5545 DURATION for a signed number of minutes: -10 → -PT10M, 540 → PT9H, 0 → PT0M. */
export function icsDuration(minutes: number): string {
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `${minutes < 0 ? '-' : ''}PT${hours ? `${hours}H` : ''}${rest || !hours ? `${rest}M` : ''}`;
}

/** The alert TRIGGER for an event (relative to its start), or null for none. */
function alertTrigger(event: CalendarEvent, alerts: IcsAlerts): string | null {
  if (event.allDay) return alerts.allDay ? icsDuration(ICS_ALL_DAY_ALERTS[alerts.allDay]) : null;
  return alerts.timed === null ? null : icsDuration(-alerts.timed);
}

/** The longest content line, in octets, before folding (RFC 5545 §3.1). */
const MAX_LINE_OCTETS = 75;

/** TEXT escaping (RFC 5545 §3.3.11): backslash, semicolon, comma and line breaks. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** UTF-8 length of one code point. */
function utf8Octets(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/**
 * Fold a content line at 75 octets — counted in UTF-8 bytes, never splitting a
 * multi-byte character, so Hebrew and Russian text survive. Each continuation
 * line starts with a single space, which counts toward its 75.
 */
export function foldIcsLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let octets = 0;
  for (const ch of line) {
    const size = utf8Octets(ch.codePointAt(0) ?? 0);
    if (octets + size > MAX_LINE_OCTETS) {
      out.push(current);
      current = ' ';
      octets = 1;
    }
    current += ch;
    octets += size;
  }
  out.push(current);
  return out.join('\r\n');
}

/** A UTC DATE-TIME value; sub-second precision is not representable. */
function utcValue(time: DateTime): string {
  return time.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
}

/** A DATE value from an ISO date. */
function dateValue(iso: string): string {
  return iso.replaceAll('-', '');
}

/** The day after an ISO date, as a DATE value (an all-day event's exclusive end). */
function nextDateValue(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10).replaceAll('-', '');
}

/** Serialize a calendar: CRLF line endings, folded lines, a trailing CRLF. */
export function serializeIcs(doc: IcsDocument): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${SITE_HOST}//Zmanim calendar export//EN`,
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(doc.name)}`,
  ];
  const stamp = utcValue(doc.stamp);
  for (const e of doc.events) {
    lines.push('BEGIN:VEVENT', `UID:${escapeIcsText(e.uid)}`, `DTSTAMP:${stamp}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateValue(e.date)}`, `DTEND;VALUE=DATE:${nextDateValue(e.date)}`);
    } else {
      lines.push(`DTSTART:${utcValue(e.start)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(e.title)}`, `DESCRIPTION:${escapeIcsText(e.description)}`, 'TRANSP:TRANSPARENT');
    const trigger = alertTrigger(e, doc.alerts ?? NO_ICS_ALERTS);
    if (trigger) {
      // A DISPLAY alarm needs ACTION, TRIGGER and DESCRIPTION (RFC 5545 §3.6.6).
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcsText(e.title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/**
 * The most events one file should hold: Google Calendar on a phone adds only
 * the first 200 events of an opened .ics file and silently drops the rest.
 */
export const MAX_EVENTS_PER_PART = 200;

/**
 * Split date-ordered events into the fewest parts of at most `max` events,
 * each a continuous run of whole days, with the largest part as small as whole
 * days allow (240 events become 2 × ~120, not 200 + 40). A day is never split
 * between parts.
 */
export function splitIcsParts<T extends { date: string }>(events: readonly T[], max = MAX_EVENTS_PER_PART): T[][] {
  if (events.length <= max) return [events.slice()];
  // Whole days, in order.
  const days: T[][] = [];
  for (const e of events) {
    const last = days.at(-1);
    if (last && last[0].date === e.date) last.push(e);
    else days.push([e]);
  }
  const pack = (cap: number): T[][] => {
    const parts: T[][] = [];
    let current: T[] = [];
    for (const day of days) {
      if (current.length > 0 && current.length + day.length > cap) {
        parts.push(current);
        current = [];
      }
      current.push(...day);
    }
    if (current.length > 0) parts.push(current);
    return parts;
  };
  // Packing whole days up to the hard cap gives the fewest parts possible.
  // Then find the smallest cap that still needs no more parts than that: it
  // gives the most even split at that count, since packing at a larger cap
  // never needs more parts. The search spans every cap up to the hard one: a
  // day holding more than `max` events (only crafted data gets there) sits in
  // a part of its own whatever the cap, so no shortcut lower bound such as the
  // equal share is safe — one could start the search above `max` and pack
  // ordinary days past it.
  const fewest = pack(max).length;
  let lo = 1;
  let hi = max;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (pack(mid).length <= fewest) hi = mid;
    else lo = mid + 1;
  }
  return pack(lo);
}

/** The file as a Blob, typed for calendar apps. */
export function icsBlob(doc: IcsDocument): Blob {
  return new Blob([serializeIcs(doc)], { type: 'text/calendar;charset=utf-8' });
}
