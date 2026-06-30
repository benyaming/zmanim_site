/**
 * Keyless geocoding. Forward search uses Open-Meteo; reverse (coords -> name)
 * uses BigDataCloud's client endpoint. Neither requires an API token, so the
 * app has no Mapbox dependency or billing. Timezone is resolved locally via
 * `tz-lookup`, so we don't rely on these services for it.
 */

export interface Place {
  id: string;
  name: string;
  /** e.g. "Brooklyn, New York, United States" */
  description: string;
  lat: number;
  lng: number;
}

interface OpenMeteoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

export async function searchCities(query: string, signal?: AbortSignal, language = 'en'): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', q);
  url.searchParams.set('count', '8');
  url.searchParams.set('language', language);
  url.searchParams.set('format', 'json');

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = (await res.json()) as { results?: OpenMeteoResult[] };

  return (data.results ?? []).map((r) => ({
    id: String(r.id),
    name: r.name,
    description: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lng: r.longitude,
  }));
}

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('localityLanguage', 'en');

  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    city?: string;
    locality?: string;
    principalSubdivision?: string;
    countryName?: string;
  };
  return data.city || data.locality || data.principalSubdivision || data.countryName || null;
}
