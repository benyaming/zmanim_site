declare module 'tz-lookup' {
  /** Returns the IANA timezone id for the given latitude/longitude. */
  export default function tzlookup(lat: number, lng: number): string;
}
