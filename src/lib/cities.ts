export interface City {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  timeZoneId: string;
  /** Candle-lighting minutes before sunset (defaults to 18; Jerusalem uses 40). */
  candleLightingOffset?: number;
}

/**
 * Curated set of well-known cities for pre-rendered SEO landing pages. City-center
 * coordinates are accurate enough for zmanim (intra-city variation is negligible).
 */
export const CITIES: readonly City[] = [
  { slug: 'jerusalem', name: 'Jerusalem', country: 'Israel', lat: 31.7683, lng: 35.2137, timeZoneId: 'Asia/Jerusalem', candleLightingOffset: 40 },
  { slug: 'tel-aviv', name: 'Tel Aviv', country: 'Israel', lat: 32.0853, lng: 34.7818, timeZoneId: 'Asia/Jerusalem' },
  { slug: 'bnei-brak', name: 'Bnei Brak', country: 'Israel', lat: 32.0807, lng: 34.8338, timeZoneId: 'Asia/Jerusalem' },
  { slug: 'haifa', name: 'Haifa', country: 'Israel', lat: 32.794, lng: 34.9896, timeZoneId: 'Asia/Jerusalem' },
  { slug: 'beer-sheva', name: "Be'er Sheva", country: 'Israel', lat: 31.2518, lng: 34.7913, timeZoneId: 'Asia/Jerusalem' },
  { slug: 'new-york', name: 'New York', country: 'United States', lat: 40.7128, lng: -74.006, timeZoneId: 'America/New_York' },
  { slug: 'brooklyn', name: 'Brooklyn', country: 'United States', lat: 40.6782, lng: -73.9442, timeZoneId: 'America/New_York' },
  { slug: 'lakewood', name: 'Lakewood', country: 'United States', lat: 40.0978, lng: -74.2176, timeZoneId: 'America/New_York' },
  { slug: 'los-angeles', name: 'Los Angeles', country: 'United States', lat: 34.0522, lng: -118.2437, timeZoneId: 'America/Los_Angeles' },
  { slug: 'miami', name: 'Miami', country: 'United States', lat: 25.7617, lng: -80.1918, timeZoneId: 'America/New_York' },
  { slug: 'chicago', name: 'Chicago', country: 'United States', lat: 41.8781, lng: -87.6298, timeZoneId: 'America/Chicago' },
  { slug: 'baltimore', name: 'Baltimore', country: 'United States', lat: 39.2904, lng: -76.6122, timeZoneId: 'America/New_York' },
  { slug: 'toronto', name: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832, timeZoneId: 'America/Toronto' },
  { slug: 'montreal', name: 'Montreal', country: 'Canada', lat: 45.5019, lng: -73.5674, timeZoneId: 'America/Toronto' },
  { slug: 'london', name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278, timeZoneId: 'Europe/London' },
  { slug: 'manchester', name: 'Manchester', country: 'United Kingdom', lat: 53.4808, lng: -2.2426, timeZoneId: 'Europe/London' },
  { slug: 'gateshead', name: 'Gateshead', country: 'United Kingdom', lat: 54.9526, lng: -1.6033, timeZoneId: 'Europe/London' },
  { slug: 'paris', name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, timeZoneId: 'Europe/Paris' },
  { slug: 'antwerp', name: 'Antwerp', country: 'Belgium', lat: 51.2194, lng: 4.4025, timeZoneId: 'Europe/Brussels' },
  { slug: 'zurich', name: 'Zurich', country: 'Switzerland', lat: 47.3769, lng: 8.5417, timeZoneId: 'Europe/Zurich' },
  { slug: 'moscow', name: 'Moscow', country: 'Russia', lat: 55.7558, lng: 37.6173, timeZoneId: 'Europe/Moscow' },
  { slug: 'buenos-aires', name: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lng: -58.3816, timeZoneId: 'America/Argentina/Buenos_Aires' },
  { slug: 'melbourne', name: 'Melbourne', country: 'Australia', lat: -37.8136, lng: 144.9631, timeZoneId: 'Australia/Melbourne' },
  { slug: 'sydney', name: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093, timeZoneId: 'Australia/Sydney' },
  { slug: 'johannesburg', name: 'Johannesburg', country: 'South Africa', lat: -26.2041, lng: 28.0473, timeZoneId: 'Africa/Johannesburg' },
];

export function getCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}
