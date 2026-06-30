import { tzFromLatLng } from './geo/timezone';

export interface AppLocation {
  lat: number;
  lng: number;
  timeZoneId: string;
  label: string;
  /** Whether to use the Israel luach (1-day Yom Tov, Israel parsha schedule). */
  inIsrael: boolean;
}

/** A location is treated as "in Israel" (for the Jewish calendar) by its timezone. */
export function isIsraelTimezone(timeZoneId: string): boolean {
  return timeZoneId === 'Asia/Jerusalem';
}

/** Build a location, resolving its IANA timezone locally from the coordinates. */
export function makeLocation(lat: number, lng: number, label: string): AppLocation {
  const timeZoneId = tzFromLatLng(lat, lng);
  return { lat, lng, timeZoneId, label, inIsrael: isIsraelTimezone(timeZoneId) };
}

export const DEFAULT_LOCATION: AppLocation = {
  lat: 31.778,
  lng: 35.2354,
  timeZoneId: 'Asia/Jerusalem',
  label: 'Jerusalem',
  inIsrael: true,
};
