import { describe, expect, it } from 'vitest';

import { isIsraelTimezone, makeLocation } from './location';

describe('isIsraelTimezone', () => {
  it('treats all Eretz Yisrael zones as Israel for the luach', () => {
    expect(isIsraelTimezone('Asia/Jerusalem')).toBe(true);
    // Legacy persisted locations can still carry the raw tz-lookup zones.
    expect(isIsraelTimezone('Asia/Hebron')).toBe(true);
    expect(isIsraelTimezone('Asia/Gaza')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isIsraelTimezone('America/New_York')).toBe(false);
    expect(isIsraelTimezone('Asia/Amman')).toBe(false);
  });
});

describe('makeLocation', () => {
  it("marks settlements in tz-lookup's Asia/Hebron polygon as in Israel", () => {
    const loc = makeLocation(31.7706, 35.2987, "Ma'ale Adumim"); // raw tz-lookup: Asia/Hebron
    expect(loc.timeZoneId).toBe('Asia/Jerusalem');
    expect(loc.inIsrael).toBe(true);
  });

  it('keeps diaspora locations in the diaspora', () => {
    const loc = makeLocation(40.6782, -73.9442, 'Brooklyn');
    expect(loc.timeZoneId).toBe('America/New_York');
    expect(loc.inIsrael).toBe(false);
  });
});
