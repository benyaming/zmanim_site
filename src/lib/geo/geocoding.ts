import {
  haversineKm,
  ISRAEL_LABEL,
  nearestSettlement,
  searchSettlements,
  type Settlement,
  settlementName,
} from './settlements';

/**
 * Keyless geocoding. Forward search uses Open-Meteo; reverse (coords -> name)
 * uses BigDataCloud's client endpoint. Neither requires an API token, so the
 * app has no Mapbox dependency or billing. Timezone is resolved locally via
 * `tz-lookup`, so we don't rely on these services for it.
 *
 * Both directions are backstopped by the bundled settlement index (see
 * `settlements.ts`): the external services miss or mislabel Israeli
 * settlements, which broke search and produced "Ramallah"-style labels.
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

function settlementPlace(s: Settlement, language: string): Place {
  const name = settlementName(s, language);
  return {
    id: `settlement-${s.slug}`,
    name,
    description: `${name}, ${ISRAEL_LABEL[language] ?? ISRAEL_LABEL.en}`,
    lat: s.lat,
    lng: s.lng,
  };
}

export async function searchCities(query: string, signal?: AbortSignal, language = 'en'): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const local = searchSettlements(q).map((s) => settlementPlace(s, language));

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', q);
  url.searchParams.set('count', '8');
  url.searchParams.set('language', language);
  url.searchParams.set('format', 'json');

  let data: { results?: OpenMeteoResult[] };
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
    data = (await res.json()) as { results?: OpenMeteoResult[] };
  } catch (err) {
    // Local matches still make the search useful when the service is down —
    // but an abort must keep propagating so react-query can ignore the result.
    if (local.length === 0 || (err instanceof DOMException && err.name === 'AbortError')) throw err;
    data = {};
  }

  // Drop remote entries that duplicate a local settlement (GeoNames has a few
  // of them under variant spellings); coordinates are a more reliable identity
  // than names across transliterations.
  const remote = (data.results ?? [])
    .map((r) => ({
      id: String(r.id),
      name: r.name,
      description: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
      lat: r.latitude,
      lng: r.longitude,
    }))
    .filter((r) => !local.some((l) => haversineKm(l.lat, l.lng, r.lat, r.lng) < 3));

  return [...local, ...remote].slice(0, 8);
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
  language = 'en',
): Promise<string | null> {
  // Inside a settlement, BigDataCloud labels users with the nearest Palestinian
  // city ("Ramallah" for Psagot) — prefer the bundled index there. 3 km covers
  // a locality's built-up area without swallowing genuinely distinct neighbors.
  const settlement = nearestSettlement(lat, lng, 3);
  if (settlement) return settlementName(settlement, language);

  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('localityLanguage', language);

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
