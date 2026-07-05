import { normalizeIsraelAreaTimezone } from './geo/timezone';
import { type AppLocation, isIsraelTimezone } from './location';

/**
 * A user-bookmarked location. The `location` snapshot keeps the original
 * geocoded label (and its locale) and the elevation; `name` is the user's own
 * name for it ("Home", "Parents") and may be empty — display then falls back
 * to the geocoded label.
 */
export interface SavedLocation {
  id: string;
  name: string;
  location: AppLocation;
}

/** The display name of a saved entry: the custom name, or the geocoded label. */
export function savedLocationDisplayName(entry: SavedLocation): string {
  return entry.name.trim() || entry.location.label;
}

/**
 * The active-location value a saved entry resolves to when selected. The
 * custom name rides along as `customLabel` so the header shows it, while
 * `label` stays the geocoded name (and keeps being re-resolved per locale).
 */
export function resolveSavedLocation(entry: SavedLocation): AppLocation {
  const name = entry.name.trim();
  return { ...entry.location, customLabel: name || undefined };
}

/** Whether a saved entry points at the given coordinates. */
export function savedLocationMatches(entry: SavedLocation, loc: Pick<AppLocation, 'lat' | 'lng'>): boolean {
  return entry.location.lat === loc.lat && entry.location.lng === loc.lng;
}

/**
 * Validate persisted saved locations, dropping malformed entries and healing
 * the derived fields the same way the active location is healed on load:
 * the timezone is re-normalized and `inIsrael` recomputed from it.
 */
export function sanitizeSavedLocations(raw: unknown): SavedLocation[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SavedLocation[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, name, location } = item as Partial<SavedLocation>;
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    if (typeof name !== 'string') continue;
    if (typeof location !== 'object' || location === null) continue;
    const { lat, lng, label, labelLocale, elevation } = location as Partial<AppLocation>;
    if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) continue;
    if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) continue;
    if (typeof label !== 'string' || !label) continue;
    if (typeof (location as Partial<AppLocation>).timeZoneId !== 'string') continue;
    const timeZoneId = normalizeIsraelAreaTimezone((location as AppLocation).timeZoneId);
    seen.add(id);
    out.push({
      id,
      name,
      location: {
        lat,
        lng,
        timeZoneId,
        label,
        labelLocale: typeof labelLocale === 'string' ? labelLocale : undefined,
        inIsrael: isIsraelTimezone(timeZoneId),
        elevation: typeof elevation === 'number' && Number.isFinite(elevation) ? elevation : undefined,
      },
    });
  }
  return out;
}
