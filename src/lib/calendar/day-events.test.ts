import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { getDayEvents } from './day-events';

// Distinct sentinel times so we can assert which zman each event references.
const TIMES = {
  candleLighting: DateTime.fromISO('2024-01-01T18:00'),
  alos: DateTime.fromISO('2024-01-01T04:00'),
  sunset: DateTime.fromISO('2024-01-01T18:18'),
  tzais: DateTime.fromISO('2024-01-01T18:50'),
};

function events(iso: string) {
  return getDayEvents(DateTime.fromISO(iso), TIMES).map((e) => e.type);
}

describe('getDayEvents', () => {
  it('shows candle lighting on Friday', () => {
    expect(events('2024-03-22')).toEqual(['candle']);
  });

  it('shows havdalah on Saturday night', () => {
    const e = getDayEvents(DateTime.fromISO('2024-03-23'), TIMES);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ type: 'havdalah', time: TIMES.tzais });
  });

  it('shows fast begin (dawn) and end (nightfall) for a minor fast', () => {
    const e = getDayEvents(DateTime.fromISO('2024-07-23'), TIMES); // 17 Tammuz
    expect(e).toEqual([
      { type: 'fastStart', time: TIMES.alos },
      { type: 'fastEnd', time: TIMES.tzais },
    ]);
  });

  it('shows candle lighting on Erev Yom Tov', () => {
    expect(events('2024-04-22')).toEqual(['candle']); // Erev Pesach
  });

  it('shows havdalah at the end of Yom Tov', () => {
    // 8th day Pesach (last day in the diaspora) → followed by a weekday.
    expect(events('2024-04-30')).toEqual(['havdalah']);
  });

  it('handles Tisha B’Av: onset on the eve, end on the day', () => {
    expect(events('2024-08-12')).toEqual(['fastStart']); // erev → sunset onset
    const day = getDayEvents(DateTime.fromISO('2024-08-13'), TIMES);
    expect(day).toEqual([{ type: 'fastEnd', time: TIMES.tzais }]);
  });

  it('shows nothing on an ordinary weekday', () => {
    expect(events('2024-03-20')).toEqual([]);
  });
});
