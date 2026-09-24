import ICAL from 'ical.js';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import type { CalendarEvent } from './calendar-events';
import { escapeIcsText, foldIcsLine, icsDuration, MAX_EVENTS_PER_PART, serializeIcs, splitIcsParts } from './ics';

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

describe('splitIcsParts', () => {
  /** `perDay` events on each of `days` consecutive days, in order. */
  const eventsOver = (days: number, perDay: (i: number) => number) =>
    Array.from({ length: days }, (_, i) => {
      const date = DateTime.fromISO('2026-09-01').plus({ days: i }).toISODate()!;
      return Array.from({ length: perDay(i) }, (_, j) => ({ date, n: `${i}-${j}` }));
    }).flat();

  const check = (events: { date: string }[], parts: { date: string }[][]) => {
    expect(parts.flat()).toEqual(events); // nothing lost, reordered or duplicated
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(MAX_EVENTS_PER_PART);
    for (let i = 1; i < parts.length; i++) expect(parts[i][0].date > parts[i - 1].at(-1)!.date).toBe(true); // no split day
  };

  it('keeps a file at the limit whole', () => {
    const events = eventsOver(200, () => 1);
    expect(splitIcsParts(events)).toHaveLength(1);
  });

  it('splits 240 events into two even parts, not 200 + 40', () => {
    const events = eventsOver(240, () => 1);
    const parts = splitIcsParts(events);
    check(events, parts);
    expect(parts.map((p) => p.length)).toEqual([120, 120]);
  });

  it('never splits a day, and uses the fewest parts whole days allow', () => {
    // ~4,700 events: six daily zmanim, nine on the Shabbat-eve days.
    const events = eventsOver(732, (i) => (i % 7 === 5 ? 9 : 6));
    const parts = splitIcsParts(events);
    check(events, parts);
    // The fewest possible: whole days packed up to the cap, one after another.
    let fewest = 1;
    let fill = 0;
    for (const size of Array.from({ length: 732 }, (_, i) => (i % 7 === 5 ? 9 : 6))) {
      if (fill + size > MAX_EVENTS_PER_PART) {
        fewest++;
        fill = 0;
      }
      fill += size;
    }
    expect(parts).toHaveLength(fewest);
  });
});

describe('alerts', () => {
  it('writes RFC 5545 durations', () => {
    expect(icsDuration(0)).toBe('PT0M');
    expect(icsDuration(-10)).toBe('-PT10M');
    expect(icsDuration(-60)).toBe('-PT1H');
    expect(icsDuration(-720)).toBe('-PT12H');
    expect(icsDuration(540)).toBe('PT9H');
    expect(icsDuration(-90)).toBe('-PT1H30M');
  });

  it('attaches one DISPLAY alarm per event, by kind, and none when none is chosen', () => {
    const text = serializeIcs({ name: 'Z', events: EVENTS, stamp: STAMP, alerts: { timed: 10, allDay: 'dayBefore18' } });
    const vevents = new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent');
    const triggers = vevents.map((v) => {
      const alarms = v.getAllSubcomponents('valarm');
      expect(alarms).toHaveLength(1);
      expect(alarms[0].getFirstPropertyValue('action')).toBe('DISPLAY');
      expect(alarms[0].getFirstPropertyValue('description')).toBe(new ICAL.Event(v).summary);
      return String(alarms[0].getFirstPropertyValue('trigger'));
    });
    // The timed candle lighting 10 minutes before; the two all-day labels at
    // 18:00 the evening before (6 hours before their midnight start).
    expect(triggers).toEqual(['-PT10M', '-PT6H', '-PT6H']);

    const timedOnly = serializeIcs({ name: 'Z', events: EVENTS, stamp: STAMP, alerts: { timed: 0, allDay: null } });
    expect(timedOnly.match(/BEGIN:VALARM/g)).toHaveLength(1);
    expect(timedOnly).toContain('TRIGGER:PT0M');

    const none = serializeIcs({ name: 'Z', events: EVENTS, stamp: STAMP, alerts: { timed: null, allDay: null } });
    expect(none).not.toContain('VALARM');
  });
});
