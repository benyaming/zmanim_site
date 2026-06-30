import { describe, expect, it } from 'vitest';

import { tzFromLatLng } from './timezone';

describe('tzFromLatLng', () => {
  it.each([
    ['Jerusalem', 31.778, 35.2354, 'Asia/Jerusalem'],
    ['Brooklyn', 40.6782, -73.9442, 'America/New_York'],
    ['London', 51.5074, -0.1278, 'Europe/London'],
    ['Buenos Aires', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires'],
    ['Los Angeles', 34.0522, -118.2437, 'America/Los_Angeles'],
    ['Tromsø', 69.6492, 18.9553, 'Europe/Oslo'],
  ])('resolves %s to %s', (_name, lat, lng, expected) => {
    expect(tzFromLatLng(lat, lng)).toBe(expected);
  });

  it('does not throw for out-of-range coordinates (clamps instead)', () => {
    expect(() => tzFromLatLng(200, 400)).not.toThrow();
    expect(() => tzFromLatLng(-200, -400)).not.toThrow();
  });

  it('returns a non-empty IANA-looking id', () => {
    const tz = tzFromLatLng(31.778, 35.2354);
    expect(tz).toMatch(/^[A-Za-z]+\/[A-Za-z_]+/);
  });
});
