import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { getDayEvents } from './day-events';

// Distinct sentinel times so we can assert which zman each fast bookend references.
const ZMANIM = {
  alosHashachar: DateTime.fromISO('2024-01-01T04:00'),
  alos72: DateTime.fromISO('2024-01-01T03:50'),
  tzaisGeonim: DateTime.fromISO('2024-01-01T18:40'),
  tzaisGeonim645: DateTime.fromISO('2024-01-01T18:41'),
  tzaisGeonim7083: DateTime.fromISO('2024-01-01T18:42'),
  tzais: DateTime.fromISO('2024-01-01T18:43'),
  tzais42: DateTime.fromISO('2024-01-01T18:44'),
  tzais72: DateTime.fromISO('2024-01-01T18:45'),
};
const TIMES = {
  candleLighting: DateTime.fromISO('2024-01-01T18:00'),
  sunset: DateTime.fromISO('2024-01-01T17:30'),
  // Distinct from tzais, so we can assert havdalah uses the chosen-opinion time.
  havdalah: DateTime.fromISO('2024-01-01T19:05'),
  zmanimByKey: ZMANIM,
};

function events(iso: string) {
  return getDayEvents(DateTime.fromISO(iso), TIMES).map((e) => e.type);
}

describe('getDayEvents', () => {
  it('shows candle lighting on Friday', () => {
    expect(events('2024-03-22')).toEqual(['candle']);
  });

  it('shows havdalah on Saturday night at the chosen-opinion time', () => {
    const e = getDayEvents(DateTime.fromISO('2024-03-23'), TIMES);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ type: 'havdalah', time: TIMES.havdalah });
  });

  it('shows fast begin (dawn) and end at the default opinions for a minor fast', () => {
    const e = getDayEvents(DateTime.fromISO('2024-07-23'), TIMES); // 17 Tammuz
    // Default-visible: Geonim 5.95°, medium-stars 7.083°, small-stars 8.5°.
    expect(e).toEqual([
      { type: 'fastStart', time: ZMANIM.alosHashachar, zmanKey: 'alosHashachar' },
      { type: 'fastEnd', time: ZMANIM.tzaisGeonim, zmanKey: 'tzaisGeonim' },
      { type: 'fastEnd', time: ZMANIM.tzaisGeonim7083, zmanKey: 'tzaisGeonim7083' },
      { type: 'fastEnd', time: ZMANIM.tzais, zmanKey: 'tzais' },
    ]);
  });

  it('starts a fast at the fixed-72-minute dawn when the degree dawn has no time', () => {
    // A short night: the sun never reaches 16.1°, so alosHashachar is null. The
    // fast still needs a start, so the next opinion supplies it — and the event
    // NAMES that opinion, so the time is never shown under a 16.1° label.
    const shortNight = { ...TIMES, zmanimByKey: { ...ZMANIM, alosHashachar: null } };
    const start = getDayEvents(DateTime.fromISO('2024-07-23'), shortNight).find((e) => e.type === 'fastStart');
    expect(start).toEqual({ type: 'fastStart', time: ZMANIM.alos72, zmanKey: 'alos72' });
  });

  it('reports a null fast start when no dawn opinion has a time (polar day)', () => {
    const polar = { ...TIMES, zmanimByKey: { ...ZMANIM, alosHashachar: null, alos72: null } };
    const start = getDayEvents(DateTime.fromISO('2024-07-23'), polar).find((e) => e.type === 'fastStart');
    expect(start).toEqual({ type: 'fastStart', time: null, zmanKey: 'alosHashachar' });
  });

  it('honors a custom hiddenFastEnd for a minor fast', () => {
    // Show only R' Tukachinsky (6.45°) and the 42-min nightfall.
    const hidden = ['tzaisGeonim', 'tzaisGeonim7083', 'tzais', 'tzais72'];
    const e = getDayEvents(DateTime.fromISO('2024-07-23'), TIMES, false, hidden);
    expect(e).toEqual([
      { type: 'fastStart', time: ZMANIM.alosHashachar, zmanKey: 'alosHashachar' },
      { type: 'fastEnd', time: ZMANIM.tzaisGeonim645, zmanKey: 'tzaisGeonim645' },
      { type: 'fastEnd', time: ZMANIM.tzais42, zmanKey: 'tzais42' },
    ]);
  });

  it('falls through to the fixed-72 nightfall when every visible fast-end is null (minor fast)', () => {
    // A short night: all default (degree) nightfall opinions are undefined. The
    // fast must still show an end, so tzais72 is appended, labelled — the same
    // fall-through the fast START uses. The blank degree rows stay, so the user
    // still sees which opinions had no time.
    const shortNight = {
      ...TIMES,
      zmanimByKey: { ...ZMANIM, tzaisGeonim: null, tzaisGeonim7083: null, tzais: null },
    };
    const ends = getDayEvents(DateTime.fromISO('2024-07-23'), shortNight).filter((e) => e.type === 'fastEnd');
    expect(ends).toEqual([
      { type: 'fastEnd', time: null, zmanKey: 'tzaisGeonim' },
      { type: 'fastEnd', time: null, zmanKey: 'tzaisGeonim7083' },
      { type: 'fastEnd', time: null, zmanKey: 'tzais' },
      { type: 'fastEnd', time: ZMANIM.tzais72, zmanKey: 'tzais72' },
    ]);
  });

  it('falls through for Tisha B\'Av when every visible default is null', () => {
    // Tisha B'Av 5784 (2024-08-13). It shows the same defaults as a minor fast;
    // when all are unreachable the fixed-72 nightfall is appended, labelled.
    const shortNight = {
      ...TIMES,
      zmanimByKey: { ...ZMANIM, tzaisGeonim: null, tzaisGeonim7083: null, tzais: null },
    };
    const ends = getDayEvents(DateTime.fromISO('2024-08-13'), shortNight).filter((e) => e.type === 'fastEnd');
    expect(ends).toEqual([
      { type: 'fastEnd', time: null, zmanKey: 'tzaisGeonim' },
      { type: 'fastEnd', time: null, zmanKey: 'tzaisGeonim7083' },
      { type: 'fastEnd', time: null, zmanKey: 'tzais' },
      { type: 'fastEnd', time: ZMANIM.tzais72, zmanKey: 'tzais72' },
    ]);
  });

  it('does not append the fallback when a visible opinion already has a time', () => {
    // Only the earliest degree opinion is null; the rest resolve, so no fall-through.
    const partial = { ...TIMES, zmanimByKey: { ...ZMANIM, tzaisGeonim: null } };
    const ends = getDayEvents(DateTime.fromISO('2024-07-23'), partial).filter((e) => e.type === 'fastEnd');
    expect(ends.map((e) => e.zmanKey)).toEqual(['tzaisGeonim', 'tzaisGeonim7083', 'tzais']);
  });

  it('does not append the fallback when tzais72 itself is undefined (polar day)', () => {
    const polar = {
      ...TIMES,
      zmanimByKey: { ...ZMANIM, tzaisGeonim: null, tzaisGeonim7083: null, tzais: null, tzais72: null },
    };
    const ends = getDayEvents(DateTime.fromISO('2024-07-23'), polar).filter((e) => e.type === 'fastEnd');
    // Three blank rows, no invented fallback.
    expect(ends.map((e) => e.zmanKey)).toEqual(['tzaisGeonim', 'tzaisGeonim7083', 'tzais']);
  });

  it('does not double-append when tzais72 is already visible', () => {
    // tzais72 shown (not hidden) and resolving → it satisfies "has a time", no append.
    const hidden = ['tzaisGeonim645', 'tzais42', 'tzais50', 'tzais60', 'tzais90'];
    const shortNight = {
      ...TIMES,
      zmanimByKey: { ...ZMANIM, tzaisGeonim: null, tzaisGeonim7083: null, tzais: null },
    };
    const ends = getDayEvents(DateTime.fromISO('2024-07-23'), shortNight, false, hidden).filter(
      (e) => e.type === 'fastEnd',
    );
    expect(ends.filter((e) => e.zmanKey === 'tzais72')).toHaveLength(1);
  });

  it('shows candle lighting on Erev Yom Tov', () => {
    expect(events('2024-04-22')).toEqual(['candle']); // Erev Pesach
  });

  it('shows the 2nd-night candle lighting at nightfall on the 1st Yom Tov day (diaspora)', () => {
    // Pesach I 5784 (Tue 2024-04-23); day 2 follows in the diaspora.
    const e = getDayEvents(DateTime.fromISO('2024-04-23'), TIMES);
    expect(e).toEqual([{ type: 'candle', time: TIMES.havdalah, afterNightfall: true }]);
  });

  it('shows havdalah (no 2nd-night candle) after the same day in Israel', () => {
    const e = getDayEvents(DateTime.fromISO('2024-04-23'), TIMES, true);
    expect(e).toEqual([{ type: 'havdalah', time: TIMES.havdalah }]);
  });

  it('keeps the pre-sunset time for Shabbat candles on a Friday Yom Tov', () => {
    // Rosh Hashana 5785: Thu 2024-10-03 (2nd night at nightfall) + Fri
    // 2024-10-04 (Shabbat follows — candles must precede sunset even on YT).
    expect(getDayEvents(DateTime.fromISO('2024-10-03'), TIMES)).toEqual([
      { type: 'candle', time: TIMES.havdalah, afterNightfall: true },
    ]);
    expect(getDayEvents(DateTime.fromISO('2024-10-04'), TIMES)).toEqual([
      { type: 'candle', time: TIMES.candleLighting },
    ]);
  });

  it('lights after nightfall (and says no havdalah) when Yom Tov starts on Motzei Shabbat', () => {
    // Shabbat 2025-04-12 = Erev Pesach 5785 → Yom Tov begins at Shabbat's end.
    const e = getDayEvents(DateTime.fromISO('2025-04-12'), TIMES);
    expect(e).toEqual([{ type: 'candle', time: TIMES.havdalah, afterNightfall: true }]);
  });

  it('shows havdalah at the end of Yom Tov', () => {
    // 8th day Pesach (last day in the diaspora) → followed by a weekday.
    expect(events('2024-04-30')).toEqual(['havdalah']);
  });

  it('ends Tisha B’Av at the default opinions, like a minor fast — onset on the eve', () => {
    expect(events('2024-08-12')).toEqual(['fastStart']); // erev → sunset onset
    // The same three defaults a minor fast shows: Geonim 5.95°, 7.083°, 8.5°.
    const day = getDayEvents(DateTime.fromISO('2024-08-13'), TIMES);
    expect(day).toEqual([
      { type: 'fastEnd', time: ZMANIM.tzaisGeonim, zmanKey: 'tzaisGeonim' },
      { type: 'fastEnd', time: ZMANIM.tzaisGeonim7083, zmanKey: 'tzaisGeonim7083' },
      { type: 'fastEnd', time: ZMANIM.tzais, zmanKey: 'tzais' },
    ]);
  });

  it('offers every fast-end opinion for Tisha B’Av when all are enabled (incl. medium-stars)', () => {
    const day = getDayEvents(DateTime.fromISO('2024-08-13'), TIMES, false, []); // show all
    expect(day).toEqual([
      { type: 'fastEnd', time: ZMANIM.tzaisGeonim, zmanKey: 'tzaisGeonim' },
      { type: 'fastEnd', time: ZMANIM.tzaisGeonim645, zmanKey: 'tzaisGeonim645' },
      { type: 'fastEnd', time: ZMANIM.tzaisGeonim7083, zmanKey: 'tzaisGeonim7083' },
      { type: 'fastEnd', time: ZMANIM.tzais, zmanKey: 'tzais' },
      { type: 'fastEnd', time: ZMANIM.tzais42, zmanKey: 'tzais42' },
      { type: 'fastEnd', time: ZMANIM.tzais72, zmanKey: 'tzais72' },
    ]);
  });

  it('keeps Yom Kippur as a single havdalah (no triple fast end)', () => {
    // 2024-10-12 is Yom Kippur (a Saturday) → ends tonight as havdalah.
    const e = getDayEvents(DateTime.fromISO('2024-10-12'), TIMES);
    expect(e).toEqual([{ type: 'havdalah', time: TIMES.havdalah }]);
  });

  it('shows nothing on an ordinary weekday', () => {
    expect(events('2024-03-20')).toEqual([]);
  });
});
