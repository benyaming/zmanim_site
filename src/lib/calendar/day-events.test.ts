import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { getDayEvents } from './day-events';

// Distinct sentinel times so we can assert which zman each fast-end references.
const TZEIT = {
  tzaisGeonim: DateTime.fromISO('2024-01-01T18:40'),
  tzaisGeonim645: DateTime.fromISO('2024-01-01T18:41'),
  tzaisGeonim7083: DateTime.fromISO('2024-01-01T18:42'),
  tzais: DateTime.fromISO('2024-01-01T18:43'),
  tzais42: DateTime.fromISO('2024-01-01T18:44'),
  tzais72: DateTime.fromISO('2024-01-01T18:45'),
};
const TIMES = {
  candleLighting: DateTime.fromISO('2024-01-01T18:00'),
  alos: DateTime.fromISO('2024-01-01T04:00'),
  sunset: DateTime.fromISO('2024-01-01T17:30'),
  // Distinct from tzais, so we can assert havdalah uses the chosen-opinion time.
  havdalah: DateTime.fromISO('2024-01-01T19:05'),
  tzeitByKey: TZEIT,
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
      { type: 'fastStart', time: TIMES.alos },
      { type: 'fastEnd', time: TZEIT.tzaisGeonim, zmanKey: 'tzaisGeonim' },
      { type: 'fastEnd', time: TZEIT.tzaisGeonim7083, zmanKey: 'tzaisGeonim7083' },
      { type: 'fastEnd', time: TZEIT.tzais, zmanKey: 'tzais' },
    ]);
  });

  it('honors a custom hiddenFastEnd for a minor fast', () => {
    // Show only R' Tukachinsky (6.45°) and the 42-min nightfall.
    const hidden = ['tzaisGeonim', 'tzaisGeonim7083', 'tzais', 'tzais72'];
    const e = getDayEvents(DateTime.fromISO('2024-07-23'), TIMES, false, hidden);
    expect(e).toEqual([
      { type: 'fastStart', time: TIMES.alos },
      { type: 'fastEnd', time: TZEIT.tzaisGeonim645, zmanKey: 'tzaisGeonim645' },
      { type: 'fastEnd', time: TZEIT.tzais42, zmanKey: 'tzais42' },
    ]);
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

  it('ends Tisha B’Av only at nightfall (never the lenient gmar-taanis) — onset on the eve', () => {
    expect(events('2024-08-12')).toEqual(['fastStart']); // erev → sunset onset
    // A major fast offers only nightfall opinions; the default shows 8.5°.
    const day = getDayEvents(DateTime.fromISO('2024-08-13'), TIMES);
    expect(day).toEqual([{ type: 'fastEnd', time: TZEIT.tzais, zmanKey: 'tzais' }]);
  });

  it('offers all three nightfall opinions for Tisha B’Av when enabled, and no medium-stars', () => {
    const day = getDayEvents(DateTime.fromISO('2024-08-13'), TIMES, false, []); // show all
    expect(day).toEqual([
      { type: 'fastEnd', time: TZEIT.tzais, zmanKey: 'tzais' },
      { type: 'fastEnd', time: TZEIT.tzais42, zmanKey: 'tzais42' },
      { type: 'fastEnd', time: TZEIT.tzais72, zmanKey: 'tzais72' },
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
