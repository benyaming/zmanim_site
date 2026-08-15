/**
 * Keyless elevation lookup (Open-Meteo, Copernicus DEM 90 m) — same provider as
 * forward geocoding, so no new dependency or token. Used to backfill
 * `AppLocation.elevation` for locations that don't come with one (GPS fix, IP
 * detection, bundled localities, legacy saves). Forward-geocoded picks carry
 * elevation directly from the search response and skip this request.
 *
 * Returns meters above sea level — can be negative (Dead Sea area); the zmanim
 * calculator clamps negatives to sea level because kosher-zmanim rejects them.
 * Best-effort: resolves to null on any failure except an abort, which keeps
 * propagating so callers can distinguish cancellation.
 */
export async function fetchElevation(lat: number, lng: number, signal?: AbortSignal): Promise<number | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/elevation');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { elevation?: number[] };
    const elevation = data.elevation?.[0];
    return typeof elevation === 'number' && Number.isFinite(elevation) ? Math.round(elevation) : null;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return null;
  }
}
