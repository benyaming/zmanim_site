import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { getDayEvents } from './day-events';

// Distinct sentinel times so we can assert which zman each event references.
const TIMES = {
  candleLighting: DateTime.fromISO('2024-01-01T18:00'),
  alos: DateTime.fromISO('2024-01-01T04:00'),
  sunset: DateTime.fromISO('2024-01-01T18:18'),
  tzaisGeonim: DateTime.fromISO('2024-01-01T18:45'),
  tzais: DateTime.fromISO('2024-01-01T18:50'),
  tzais42: DateTime.fromISO('2024-01-01T19:00'),
  // Distinct from tzais, so we can assert havdalah uses the chosen-opinion time.
  havdalah: DateTime.fromISO('2024-01-01T19:05'),
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

  it('shows fast begin (dawn) and end at all three tzeit opinions for a minor fast', () => {
    const e = getDayEvents(DateTime.fromISO('2024-07-23'), TIMES); // 17 Tammuz
    expect(e).toEqual([
      { type: 'fastStart', time: TIMES.alos },
      { type: 'fastEnd', time: TIMES.tzaisGeonim, zmanKey: 'tzaisGeonim' },
      { type: 'fastEnd', time: TIMES.tzais, zmanKey: 'tzais' },
      { type: 'fastEnd', time: TIMES.tzais42, zmanKey: 'tzais42' },
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

  it('handles Tisha B’Av: onset on the eve, end on the day at all three opinions', () => {
    expect(events('2024-08-12')).toEqual(['fastStart']); // erev → sunset onset
    const day = getDayEvents(DateTime.fromISO('2024-08-13'), TIMES);
    expect(day).toEqual([
      { type: 'fastEnd', time: TIMES.tzaisGeonim, zmanKey: 'tzaisGeonim' },
      { type: 'fastEnd', time: TIMES.tzais, zmanKey: 'tzais' },
      { type: 'fastEnd', time: TIMES.tzais42, zmanKey: 'tzais42' },
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
