import { JewishCalendar } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { reportTranslator } from '@/components/tools/export-i18n';
import { observanceChipText } from '@/components/tools/personal-dates-labels';
import {
  createHebrewFormatter,
  DEFAULT_HIDDEN_FAST_END,
  dayEventZmanKeys,
  getDayEvents,
  getDayInfo,
  localizedHolidayLabel,
} from '@/lib/calendar';
import { formatTimeWithSeconds } from '@/lib/format';
import type { AppLocation } from '@/lib/location';
import { type ObservanceKind, partsFromDay, type PersonalDatesData, sanitizePersonalDates } from '@/lib/personal-dates';
import {
  applyLehumraToEvents,
  computeZmanim,
  DEFAULT_HAVDALAH_OPINION,
  havdalahTime,
  havdalahZmanKey,
  roundTimeLehumra,
  zmanLehumraDirection,
} from '@/lib/zmanim';

import {
  buildCalendarEvents,
  type CalendarEvent,
  type CalendarExportOptions,
  locationFingerprint,
  type TimedCalendarEvent,
} from './calendar-events';
import { ICS_DAILY_ZMAN_KEYS, MAX_ICS_DAYS } from './ics-preset';

const JERUSALEM: AppLocation = {
  lat: 31.7683,
  lng: 35.2137,
  timeZoneId: 'Asia/Jerusalem',
  inIsrael: true,
  label: 'Jerusalem',
};
const NEW_YORK: AppLocation = { lat: 40.7128, lng: -74.006, timeZoneId: 'America/New_York', inIsrael: false, label: 'New York' };

const tr = reportTranslator('en');
const tp = (key: string, values?: Record<string, string | number>) => tr(`personalDates.${key}`, values);
const ALL = { candles: true, fasts: true, holidays: true, parsha: true };
const NONE = { candles: false, fasts: false, holidays: false, parsha: false };
const EMPTY: PersonalDatesData = { people: [], occasions: [] };

function build(over: Partial<CalendarExportOptions> = {}) {
  return buildCalendarEvents({
    startIso: '2026-09-01',
    days: 30,
    location: JERUSALEM,
    placeLabel: 'Jerusalem',
    categories: ALL,
    zmanKeys: [],
    personalKinds: [],
    personalDates: EMPTY,
    candleLightingOffset: 40,
    havdalahOpinion: DEFAULT_HAVDALAH_OPINION,
    hiddenFastEnd: DEFAULT_HIDDEN_FAST_END,
    useElevation: false,
    lehumra: false,
    locale: 'en',
    tr,
    personalTitle: (obs) => observanceChipText(obs, tp),
    ...over,
  });
}

const timed = (events: CalendarEvent[]): TimedCalendarEvent[] => events.filter((e): e is TimedCalendarEvent => !e.allDay);
const noonOf = (iso: string, tz: string) => {
  const d = DateTime.fromISO(iso);
  return DateTime.fromObject({ year: d.year, month: d.month, day: d.day, hour: 12 }, { zone: tz });
};
/** Whole seconds since the epoch — what a DATE-TIME can carry. */
const seconds = (t: DateTime) => Math.floor(t.toMillis() / 1000);

/** The app's own day events for a day: raw times, then (optionally) one lehumra pass. */
function appDayEvents(location: AppLocation, iso: string, lehumra: boolean) {
  const noon = noonOf(iso, location.timeZoneId);
  const computed = computeZmanim({
    lat: location.lat,
    lng: location.lng,
    date: noon,
    timeZoneId: location.timeZoneId,
    candleLightingOffset: 40,
    keys: dayEventZmanKeys(havdalahZmanKey(DEFAULT_HAVDALAH_OPINION)),
  });
  const byKey = Object.fromEntries(computed.map((z) => [z.key, z.time]));
  const raw = getDayEvents(
    noon,
    {
      candleLighting: byKey.candleLighting,
      sunset: byKey.sunset,
      havdalah: havdalahTime(DEFAULT_HAVDALAH_OPINION, byKey),
      zmanimByKey: byKey,
    },
    location.inIsrael,
    DEFAULT_HIDDEN_FAST_END,
  );
  return lehumra ? applyLehumraToEvents(raw) : raw;
}

/** The first day in a range whose day info satisfies a predicate. */
function findDay(startIso: string, days: number, location: AppLocation, pred: (iso: string) => boolean): string {
  for (let i = 0; i < days; i++) {
    const iso = DateTime.fromISO(startIso).plus({ days: i }).toISODate()!;
    if (pred(iso)) return iso;
  }
  throw new Error('no such day');
}
const infoOn = (iso: string, location: AppLocation) =>
  getDayInfo(noonOf(iso, location.timeZoneId), createHebrewFormatter('en'), 'en', location.inIsrael);

describe('buildCalendarEvents — parity with the app', () => {
  for (const location of [JERUSALEM, NEW_YORK]) {
    for (const lehumra of [false, true]) {
      it(`every candle/havdalah/fast event equals the app's own event (${location.label}, lehumra ${lehumra})`, () => {
        const { events } = build({ location, placeLabel: location.label, lehumra, startIso: '2026-09-01', days: 60 });
        const dayEvents = timed(events).filter((e) => e.kind !== 'zman');
        expect(dayEvents.length).toBeGreaterThan(20);
        for (const e of dayEvents) {
          const expected = appDayEvents(location, e.date, lehumra).filter(
            (a) => a.type === e.kind && (a.type !== 'fastEnd' || a.zmanKey === e.key),
          );
          expect(expected, `${e.uid}`).toHaveLength(1);
          expect(seconds(e.start), e.title).toBe(seconds(expected[0].time!));
        }
        // …and nothing the app shows is missing.
        for (let i = 0; i < 60; i++) {
          const iso = DateTime.fromISO('2026-09-01').plus({ days: i }).toISODate()!;
          const shown = appDayEvents(location, iso, lehumra).filter((a) => a.time);
          expect(dayEvents.filter((e) => e.date === iso), iso).toHaveLength(shown.length);
        }
      });
    }
  }
});

describe('buildCalendarEvents — rounding', () => {
  it('rounds a minor fast start DOWN from raw dawn (Tzom Gedaliah 2026, Jerusalem: 05:09:28 → 05:09)', () => {
    const on = build({ startIso: '2026-09-14', days: 1, lehumra: true });
    const start = timed(on.events).find((e) => e.kind === 'fastStart')!;
    expect(start.start.setZone('Asia/Jerusalem').toFormat('HH:mm:ss')).toBe('05:09:00');

    const off = build({ startIso: '2026-09-14', days: 1, lehumra: false });
    const exact = timed(off.events).find((e) => e.kind === 'fastStart')!;
    expect(exact.start.setZone('Asia/Jerusalem').toFormat('HH:mm:ss')).toBe('05:09:28');
  });

  it('rounds each daily zman by its own direction, from the raw instant', () => {
    const { events } = build({ startIso: '2026-09-10', days: 3, lehumra: true, zmanKeys: ['alosHashachar', 'sofZmanShmaGRA'] });
    for (const e of timed(events).filter((x) => x.kind === 'zman')) {
      const raw = computeZmanim({
        lat: JERUSALEM.lat,
        lng: JERUSALEM.lng,
        date: noonOf(e.date, 'Asia/Jerusalem'),
        timeZoneId: 'Asia/Jerusalem',
        keys: [e.key!],
      })[0].time!;
      expect(e.start.toMillis()).toBe(roundTimeLehumra(raw, zmanLehumraDirection(e.key!)).toMillis());
    }
  });

  it('without rounding, titles carry the exact time with seconds', () => {
    const { events } = build({ startIso: '2026-09-04', days: 2, lehumra: false });
    const havdalah = timed(events).find((e) => e.kind === 'havdalah')!;
    const clock = formatTimeWithSeconds(havdalah.start.setZone('Asia/Jerusalem'), 'en');
    expect(havdalah.title).toBe(`Havdala · Jerusalem · ${clock}`);
  });

  it('with rounding, titles carry no time and starts sit on the minute', () => {
    const { events } = build({ startIso: '2026-09-04', days: 2, lehumra: true });
    for (const e of timed(events)) {
      expect(e.start.second).toBe(0);
      expect(e.start.millisecond).toBe(0);
    }
    expect(timed(events).find((e) => e.kind === 'havdalah')!.title).toBe('Havdala · Jerusalem');
  });
});

describe('buildCalendarEvents — fasts and Yom Kippur', () => {
  it('Yom Kippur 2026: its candle lighting and end appear once each, under either category', () => {
    for (const categories of [ALL, { ...NONE, fasts: true }, { ...NONE, candles: true }]) {
      const { events } = build({ categories, startIso: '2026-09-19', days: 4 });
      const titles = timed(events).map((e) => `${e.date} ${e.title}`);
      expect(titles.filter((t) => t.includes('Yom Kippur candle lighting'))).toHaveLength(1);
      expect(titles.filter((t) => t.startsWith('2026-09-20') && t.includes('Yom Kippur candle lighting'))).toHaveLength(1);
      expect(titles.filter((t) => t.includes('Yom Kippur ends (havdala)'))).toHaveLength(1);
      expect(titles.filter((t) => t.startsWith('2026-09-21') && t.includes('Yom Kippur ends (havdala)'))).toHaveLength(1);
    }
    const none = build({ categories: { ...NONE, holidays: true }, startIso: '2026-09-19', days: 4 });
    expect(timed(none.events)).toHaveLength(0);
  });

  it("Tisha b'Av starts at the eve's sunset, named after the fast", () => {
    const tb = findDay('2026-07-01', 60, JERUSALEM, (iso) => infoOn(iso, JERUSALEM).yomTovIndex === JewishCalendar.TISHA_BEAV);
    const eve = DateTime.fromISO(tb).minus({ days: 1 }).toISODate()!;
    const { events } = build({ categories: { ...NONE, fasts: true }, startIso: eve, days: 2 });
    const start = timed(events).find((e) => e.kind === 'fastStart')!;
    expect(start.date).toBe(eve);
    const sunset = computeZmanim({
      lat: JERUSALEM.lat,
      lng: JERUSALEM.lng,
      date: noonOf(eve, 'Asia/Jerusalem'),
      timeZoneId: 'Asia/Jerusalem',
      keys: ['sunset'],
    })[0].time!;
    expect(seconds(start.start)).toBe(seconds(sunset));
    const tbInfo = infoOn(tb, JERUSALEM);
    expect(start.title).toContain(localizedHolidayLabel('en', tbInfo.label, tbInfo.yomTovIndex)!);
  });

  it("a fast's end appears once per visible opinion, each with its own UID", () => {
    const { events } = build({ categories: { ...NONE, fasts: true }, startIso: '2026-09-14', days: 1 });
    const ends = timed(events).filter((e) => e.kind === 'fastEnd');
    const expected = appDayEvents(JERUSALEM, '2026-09-14', false).filter((e) => e.type === 'fastEnd');
    expect(ends).toHaveLength(expected.length);
    expect(new Set(ends.map((e) => e.uid)).size).toBe(ends.length);
  });

  it('omits and counts times that cannot be computed (polar day), never inventing one', () => {
    const tromso: AppLocation = { lat: 69.6496, lng: 18.956, timeZoneId: 'Europe/Oslo', inIsrael: false, label: 'Tromsø' };
    const { events, unavailable } = build({ location: tromso, placeLabel: 'Tromsø', startIso: '2026-06-01', days: 30 });
    expect(unavailable).toBeGreaterThan(0);
    for (const e of timed(events)) expect(e.start.isValid).toBe(true);
  });
});

describe('buildCalendarEvents — day labels', () => {
  it('Chanukah on Rosh Chodesh is one all-day event carrying both', () => {
    const day = findDay('2026-12-01', 40, JERUSALEM, (iso) => {
      const info = infoOn(iso, JERUSALEM);
      return info.dayOfChanukah > 0 && info.isRoshChodesh;
    });
    const { events } = build({ categories: { ...NONE, holidays: true }, startIso: day, days: 1 });
    const info = infoOn(day, JERUSALEM);
    const label = localizedHolidayLabel('en', info.label, info.yomTovIndex, info.dayOfChanukah)!;
    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(true);
    expect(events[0].title).toBe(`${label} · Rosh Chodesh`);
  });

  it('names the parsha on Shabbat, and only on Shabbat', () => {
    // 1–30 Oct 2026 in Israel: Shemini Atzeret takes Shabbat the 3rd, which
    // reads no parsha; the 10th, 17th and 24th do.
    const { events } = build({ categories: { ...NONE, parsha: true }, startIso: '2026-10-01', days: 30 });
    expect(events.map((e) => e.date)).toEqual(['2026-10-10', '2026-10-17', '2026-10-24']);
    for (const e of events) {
      expect(DateTime.fromISO(e.date).weekday).toBe(6);
      expect(e.title).toMatch(/Parashat |Shabbat /);
    }
  });

  it('dates follow the location, not the device, zone', () => {
    // Far from the device's zone in both directions. (Not Sydney or Auckland:
    // kosher-zmanim 0.9 rolls their date forward a day — an app-wide issue
    // tracked separately, which this export inherits rather than hides.)
    const places: AppLocation[] = [
      { lat: 35.68, lng: 139.69, timeZoneId: 'Asia/Tokyo', inIsrael: false, label: 'Tokyo' },
      { lat: 21.31, lng: -157.86, timeZoneId: 'Pacific/Honolulu', inIsrael: false, label: 'Honolulu' },
    ];
    for (const location of places) {
      const { events } = build({ location, placeLabel: location.label, startIso: '2026-10-01', days: 31 });
      const dates = events.map((e) => e.date).sort();
      expect(dates[0] >= '2026-10-01').toBe(true);
      expect(dates.at(-1)! <= '2026-10-31').toBe(true);
      for (const e of timed(events)) expect(e.start.setZone(location.timeZoneId).toISODate(), e.title).toBe(e.date);
    }
  });
});

describe('buildCalendarEvents — daily zmanim', () => {
  it('rejects durations and caps the selection at six, in definition order', () => {
    const eight = ICS_DAILY_ZMAN_KEYS.slice(0, 8);
    const { events } = build({ categories: NONE, startIso: '2026-09-10', days: 1, zmanKeys: ['shaahZmanisGRA', ...eight.reverse()] });
    expect([...new Set(events.map((e) => e.key))].sort()).toEqual(ICS_DAILY_ZMAN_KEYS.slice(0, 6).sort());
  });
});

describe('buildCalendarEvents — identity', () => {
  const uids = (over: Partial<CalendarExportOptions>) => build({ startIso: '2026-09-01', days: 45, ...over }).events.map((e) => e.uid);

  it('settings revise events rather than create new ones', () => {
    const base = uids({});
    expect(uids({ candleLightingOffset: 18 })).toEqual(base);
    expect(uids({ lehumra: true })).toEqual(base);
    expect(uids({ useElevation: true, location: { ...JERUSALEM, elevation: 800 } })).toEqual(base);
    expect(uids({ havdalahOpinion: 'tzeis_72_minutes' as never })).toEqual(base);
  });

  it('the place is its coordinates and zone — never its label or bookmark', () => {
    const base = uids({});
    expect(uids({ location: { ...JERUSALEM, label: 'ירושלים', customLabel: 'Home' }, placeLabel: 'Home' })).toEqual(base);
    expect(locationFingerprint({ ...JERUSALEM, timeZoneId: 'Asia/Hebron' })).toBe(locationFingerprint(JERUSALEM));
    expect(locationFingerprint({ ...JERUSALEM, lat: 31.7684 })).not.toBe(locationFingerprint(JERUSALEM));
    const other = uids({ location: NEW_YORK, placeLabel: 'New York' });
    expect(other.filter((u) => base.includes(u))).toEqual([]);
  });

  it('every UID in a long export is unique', () => {
    const { events } = build({ startIso: '2026-01-01', days: MAX_ICS_DAYS, zmanKeys: ['sunrise', 'sunset'] });
    expect(new Set(events.map((e) => e.uid)).size).toBe(events.length);
  });
});

describe('buildCalendarEvents — personal dates', () => {
  const anchor = { hebrew: partsFromDay(DateTime.fromISO('2015-03-10')) };
  const death = { hebrew: partsFromDay(DateTime.fromISO('2010-11-02')) };
  const personal: PersonalDatesData = {
    people: [
      {
        id: 'p1',
        name: 'Dana',
        gender: 'female',
        events: [
          { id: 'b1', kind: 'birth', anchor },
          { id: 'c1', kind: 'custom', label: 'Aliyah', anchor },
          { id: 'c2', kind: 'custom', label: 'Graduation', anchor },
        ],
      },
      { id: 'p2', name: 'Moshe', events: [{ id: 'd1', kind: 'death', anchor: death }] },
    ],
    occasions: [{ id: 'p1', kind: 'wedding', label: 'Our wedding', anchor }],
  };

  it('keeps every occurrence distinct, and follows the chosen kinds', () => {
    const all = build({
      categories: NONE,
      startIso: '2026-01-01',
      days: MAX_ICS_DAYS,
      personalDates: personal,
      personalKinds: ['civilBirthday', 'civilAnniversary', 'yahrzeit'],
    }).events;
    expect(all.every((e) => e.allDay && e.kind === 'personal')).toBe(true);
    expect(new Set(all.map((e) => e.uid)).size).toBe(all.length);
    // Two civil birthdays in two years; three anniversary owners on each 10 March.
    expect(all.filter((e) => e.key === 'civilBirthday').map((e) => e.date)).toEqual(['2026-03-10', '2027-03-10']);
    expect(all.filter((e) => e.key === 'civilAnniversary' && e.date === '2026-03-10')).toHaveLength(3);
    expect(all.some((e) => e.key === 'hebrewBirthday')).toBe(false);
  });

  it('notes that a yahrzeit begins the evening before, and nothing else does', () => {
    const { events } = build({
      categories: NONE,
      startIso: '2026-01-01',
      days: 400,
      personalDates: personal,
      personalKinds: ['yahrzeit', 'civilDeathAnniversary'],
    });
    const yahrzeit = events.find((e) => e.key === 'yahrzeit')!;
    const civil = events.find((e) => e.key === 'civilDeathAnniversary')!;
    expect(yahrzeit.description).toContain('begins the evening before');
    expect(civil.description).not.toContain('begins the evening before');
  });

  it('ids containing the separator never make two owners share a UID', () => {
    // Free-form ids survive the real sanitizer; a joined "p-a"+"b" and
    // "p"+"a-b" must still be two events.
    const civil = { hebrew: partsFromDay(DateTime.fromISO('2000-10-02')) };
    const tricky = sanitizePersonalDates({
      people: [
        { id: 'p-a', name: 'One', events: [{ id: 'b', kind: 'birth', anchor: civil }] },
        { id: 'p', name: 'Two', events: [{ id: 'a-b', kind: 'birth', anchor: civil }] },
      ],
      occasions: [],
    });
    expect(tricky.people.map((p) => p.id)).toEqual(['p-a', 'p']);
    const { events } = build({
      categories: NONE,
      startIso: '2026-10-02',
      days: 1,
      personalDates: tricky,
      personalKinds: ['civilBirthday'],
    });
    expect(events.map((e) => e.title).sort()).toEqual(['One · turns 26 · civil', 'Two · turns 26 · civil']);
    expect(new Set(events.map((e) => e.uid)).size).toBe(2);
  });

  it('an origin day is one event whose UID does not depend on which of the pair is selected', () => {
    const today = { hebrew: partsFromDay(DateTime.fromISO('2026-10-02')) };
    const origins: PersonalDatesData = {
      people: [
        { id: 'b', name: 'Baby', gender: 'male', events: [{ id: 'be', kind: 'birth', anchor: today }] },
        { id: 'd', name: 'Grandpa', events: [{ id: 'de', kind: 'death', anchor: today }] },
      ],
      occasions: [{ id: 'w', kind: 'wedding', label: 'Wedding', anchor: today }],
    };
    const pairs: [ObservanceKind, ObservanceKind][] = [
      ['hebrewBirthday', 'civilBirthday'],
      ['yahrzeit', 'civilDeathAnniversary'],
      ['hebrewAnniversary', 'civilAnniversary'],
    ];
    for (const [hebrew, civil] of pairs) {
      const uidsFor = (kinds: ObservanceKind[]) =>
        build({ categories: NONE, startIso: '2026-10-02', days: 1, personalDates: origins, personalKinds: kinds }).events.map(
          (e) => e.uid,
        );
      const both = uidsFor([hebrew, civil]);
      expect(both, hebrew).toHaveLength(1);
      expect(uidsFor([hebrew])).toEqual(both);
      expect(uidsFor([civil])).toEqual(both);
    }
  });

  it('an empty kind selection means no personal dates', () => {
    const { events } = build({ categories: NONE, startIso: '2026-01-01', days: 400, personalDates: personal, personalKinds: [] });
    expect(events).toHaveLength(0);
  });
});

describe('buildCalendarEvents — range', () => {
  it('accepts 1 and MAX_ICS_DAYS days, rejects 0 and MAX_ICS_DAYS + 1', () => {
    expect(() => build({ days: 1 })).not.toThrow();
    expect(() => build({ days: MAX_ICS_DAYS, categories: { ...NONE, holidays: true } })).not.toThrow();
    expect(() => build({ days: 0 })).toThrow(RangeError);
    expect(() => build({ days: MAX_ICS_DAYS + 1 })).toThrow(RangeError);
    expect(() => build({ startIso: 'not-a-date' })).toThrow(RangeError);
  });
});
