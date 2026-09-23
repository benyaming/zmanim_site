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

/** The file as a Blob, typed for calendar apps. */
export function icsBlob(doc: IcsDocument): Blob {
  return new Blob([serializeIcs(doc)], { type: 'text/calendar;charset=utf-8' });
}
