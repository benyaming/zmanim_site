import ICAL from 'ical.js';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import type { CalendarEvent } from './calendar-events';
import { escapeIcsText, foldIcsLine, serializeIcs } from './ics';

const octets = (s: string) => new TextEncoder().encode(s).length;
const unfold = (s: string) => s.replace(/\r\n /g, '');

const STAMP = DateTime.fromISO('2026-09-23T10:00:00Z', { zone: 'utc' });

const EVENTS: CalendarEvent[] = [
  {
    kind: 'candle',
    uid: 'candle-20260925-abc@zmanim.ginzburg.io',
    allDay: false,
    date: '2026-09-25',
    start: DateTime.fromISO('2026-09-25T15:23:47.912Z', { zone: 'utc' }),
    title: 'הדלקת נרות · ירושלים, "בית"; 18:23',
    description: 'Line one\nLine two, with a comma; and a semicolon \\ backslash',
  },
  {
    kind: 'holiday',
    uid: 'holiday-20261231-abc@zmanim.ginzburg.io',
    allDay: true,
    date: '2026-12-31',
    title: 'Зажигание свечей, Ханука · Рош Ходеш',
    description: 'Метка календарного дня',
  },
  {
    kind: 'personal',
    key: 'yahrzeit',
    uid: 'personal-person-p1-d1-yahrzeit-20270228@zmanim.ginzburg.io',
    allDay: true,
    date: '2027-02-28',
    title: 'Moshe\r\nCohen · 17th yahrzeit',
    description: '',
  },
];

describe('escapeIcsText', () => {
  it('escapes backslash, semicolon, comma and every line break', () => {
    expect(escapeIcsText('a,b;c\\d\ne\r\nf\rg')).toBe('a\\,b\\;c\\\\d\\ne\\nf\\ng');
  });
});

describe('foldIcsLine', () => {
  it('leaves a short line alone', () => {
    expect(foldIcsLine('SUMMARY:short')).toBe('SUMMARY:short');
  });

  it('folds ASCII at 75 octets, continuation lines included', () => {
    const line = `DESCRIPTION:${'x'.repeat(300)}`;
    const folded = foldIcsLine(line);
    for (const physical of folded.split('\r\n')) expect(octets(physical)).toBeLessThanOrEqual(75);
    expect(unfold(folded)).toBe(line);
  });

  it('never splits a multi-byte character (Hebrew, Russian, emoji)', () => {
    const line = `SUMMARY:${'שלום עולם · '.repeat(12)}${'Привет мир · '.repeat(12)}${'🕯️'.repeat(20)}`;
    const folded = foldIcsLine(line);
    for (const physical of folded.split('\r\n')) {
      expect(octets(physical)).toBeLessThanOrEqual(75);
      // A split character would not survive a UTF-8 round trip.
      expect(new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(physical))).toBe(physical);
    }
    expect(unfold(folded)).toBe(line);
  });
});

describe('serializeIcs', () => {
  const text = serializeIcs({ name: 'Zmanim · ירושלים', events: EVENTS, stamp: STAMP });

  it('uses CRLF throughout, ends with one, and has no bare line feeds', () => {
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('is a plain calendar collection: no METHOD, no SEQUENCE, no alarms', () => {
    const body = unfold(text);
    expect(body).toMatch(/^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\nPRODID:/);
    expect(body).not.toMatch(/^METHOD:/m);
    expect(body).not.toMatch(/^SEQUENCE:/m);
    expect(body).not.toMatch(/VALARM/);
    expect(body.match(/^TRANSP:TRANSPARENT$/gm)).toHaveLength(EVENTS.length);
  });

  it('writes timed starts in UTC to the whole second, with no DTEND', () => {
    const body = unfold(text);
    expect(body).toContain('DTSTART:20260925T152347Z');
    const timedBlock = body.split('BEGIN:VEVENT')[1];
    expect(timedBlock).not.toContain('DTEND');
  });

  it('writes all-day events as DATE values ending the next day, across a year boundary', () => {
    const body = unfold(text);
    expect(body).toContain('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101');
    expect(body).toContain('DTSTART;VALUE=DATE:20270228\r\nDTEND;VALUE=DATE:20270301');
  });

  it('parses back identically with an independent parser (ical.js)', () => {
    const calendar = new ICAL.Component(ICAL.parse(text));
    expect(calendar.getFirstPropertyValue('x-wr-calname')).toBe('Zmanim · ירושלים');
    expect(calendar.getFirstPropertyValue('method')).toBeNull();
    const vevents = calendar.getAllSubcomponents('vevent');
    expect(vevents).toHaveLength(EVENTS.length);
    vevents.forEach((v, i) => {
      const event = new ICAL.Event(v);
      const expected = EVENTS[i];
      expect(event.uid).toBe(expected.uid);
      // Line breaks in a title come back as \n (the escape carries no CR).
      expect(event.summary).toBe(expected.title.replace(/\r\n|\r/g, '\n'));
      expect(event.description ?? '').toBe(expected.description);
      expect(event.startDate.isDate).toBe(expected.allDay);
      if (!expected.allDay) {
        expect(event.startDate.toUnixTime()).toBe(Math.floor(expected.start.toSeconds()));
      } else {
        expect(event.startDate.toString()).toBe(expected.date);
      }
    });
  });
});
