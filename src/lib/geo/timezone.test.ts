import { describe, expect, it } from 'vitest';

import { normalizeIsraelAreaTimezone, tzFromLatLng } from './timezone';

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

  // tz-lookup's raw polygons put all of these in Asia/Hebron (or Asia/Gaza) —
  // including Jerusalem neighborhoods — which broke the inIsrael luach flag
  // and would drift off the Israeli clock when Palestinian DST diverges.
  it.each([
    ['Gilo (Jerusalem)', 31.728, 35.188],
    ["Ma'ale Adumim", 31.7706, 35.2987],
    ['Ariel', 32.1061, 35.1851],
    ['Ramallah', 31.9038, 35.2034],
    ['Gaza', 31.5017, 34.4668],
  ])('normalizes %s to Asia/Jerusalem', (_name, lat, lng) => {
    expect(tzFromLatLng(lat, lng)).toBe('Asia/Jerusalem');
  });

  it('does not touch neighboring countries', () => {
    expect(tzFromLatLng(31.9539, 35.9106)).toBe('Asia/Amman');
    expect(tzFromLatLng(33.8938, 35.5018)).toBe('Asia/Beirut');
    expect(tzFromLatLng(30.0444, 31.2357)).toBe('Africa/Cairo');
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

describe('normalizeIsraelAreaTimezone', () => {
  it('collapses the Palestinian zones to Asia/Jerusalem and passes everything else through', () => {
    expect(normalizeIsraelAreaTimezone('Asia/Hebron')).toBe('Asia/Jerusalem');
    expect(normalizeIsraelAreaTimezone('Asia/Gaza')).toBe('Asia/Jerusalem');
    expect(normalizeIsraelAreaTimezone('Asia/Jerusalem')).toBe('Asia/Jerusalem');
    expect(normalizeIsraelAreaTimezone('America/New_York')).toBe('America/New_York');
  });
});
